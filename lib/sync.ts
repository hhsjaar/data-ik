import { cabutSumber, ekstrak, rapikan, terapkan } from "./extract";
import { geminiConfigured } from "./gemini";
import { rapi } from "./normalize";
import { hashText, loadReports } from "./reports";
import { mutate, newId, now, readDb } from "./store";
import { jenisInfo, type Asal, type Catatan } from "./types";

export type SyncStatus = {
  berjalan: boolean;
  mulai: string | null;
  selesai: string | null;
  total: number;
  selesaiCount: number;
  baru: { lokasi: number; orang: number; kejadian: number };
  galat: Array<{ id: string; pesan: string }>;
  galatUmum: string | null;
};

const g = globalThis as unknown as { __dataikSync?: SyncStatus };
const status = (g.__dataikSync ??= {
  berjalan: false,
  mulai: null,
  selesai: null,
  total: 0,
  selesaiCount: 0,
  baru: { lokasi: 0, orang: 0, kejadian: 0 },
  galat: [],
  galatUmum: null,
});

export const getSyncStatus = (): SyncStatus => status;

/** Hitung berapa laporan yang belum diproses / berubah sejak diproses. */
export async function hitungAntrean() {
  const [rows, db] = await Promise.all([loadReports(), readDb()]);
  const antre = rows.filter((r) => db.diproses[r.id]?.hash !== hashText(r.content || ""));
  return { totalLaporan: rows.length, antre: antre.length, sudah: rows.length - antre.length };
}

const PARALEL = 4;

/**
 * Proses laporan yang belum/berubah di latar belakang. `ulang` memproses
 * semua laporan dari awal (data tangan tetap dipertahankan).
 */
export async function mulaiSync(opts: { ulang?: boolean; batas?: number } = {}) {
  if (status.berjalan) return status;
  if (!geminiConfigured()) throw new Error("GEMINI_API_KEY belum diisi di .env.local");
  const [rows, db] = await Promise.all([loadReports(true), readDb()]);
  let antre = rows.filter((r) => opts.ulang || db.diproses[r.id]?.hash !== hashText(r.content || ""));
  antre.sort((a, b) => a.created_at.localeCompare(b.created_at)); // lama -> baru agar jabatan terbaru menang
  if (opts.batas) antre = antre.slice(0, opts.batas);

  Object.assign(status, {
    berjalan: true,
    mulai: now(),
    selesai: null,
    total: antre.length,
    selesaiCount: 0,
    baru: { lokasi: 0, orang: 0, kejadian: 0 },
    galat: [],
    galatUmum: null,
  });

  void (async () => {
    // Satu penerapan per laporan, berurutan menurut tanggal; ekstraksi LLM berjalan paralel.
    const hasil = new Map<number, Awaited<ReturnType<typeof ekstrak>> | Error>();
    let ptr = 0;
    let giliran = 0; // indeks berikut yang boleh diterapkan

    const pekerja = async () => {
      for (;;) {
        const i = ptr++;
        if (i >= antre.length) return;
        const r = antre[i];
        try {
          hasil.set(
            i,
            await ekstrak({
              teks: r.content || "",
              jenisLaporan: jenisInfo(r.template_type).label,
              perihal: r.perihal || "",
              tanggal: r.created_at,
              denganKejadian: r.template_type === "laporan-kegiatan",
            }),
          );
        } catch (e) {
          hasil.set(i, e instanceof Error ? e : new Error(String(e)));
        }
        // terapkan sesuai urutan
        while (giliran < antre.length && hasil.has(giliran)) {
          const idx = giliran++;
          const rr = antre[idx];
          const h = hasil.get(idx)!;
          hasil.delete(idx);
          if (h instanceof Error) {
            status.galat.push({ id: rr.id, pesan: h.message.slice(0, 200) });
          } else {
            const tambah = await mutate((d) => {
              cabutSumber(d, rr.id);
              const t = terapkan(d, h, { sumberId: rr.id, asal: "laporan", tanggal: rr.created_at, manual: false });
              d.diproses[rr.id] = { at: now(), hash: hashText(rr.content || ""), ...t };
              return t;
            });
            status.baru.lokasi += tambah.lokasi;
            status.baru.orang += tambah.orang;
            status.baru.kejadian += tambah.kejadian;
          }
          status.selesaiCount++;
        }
      }
    };

    try {
      await Promise.all(Array.from({ length: Math.min(PARALEL, antre.length) }, pekerja));
    } catch (e) {
      status.galatUmum = e instanceof Error ? e.message : String(e);
      await mutate((d) => void rapikan(d));
    } finally {
      status.berjalan = false;
      status.selesai = now();
    }
  })();

  return status;
}

/** Gabungkan duplikat pada data yang sudah ada. */
export const rapikanData = () => mutate((d) => rapikan(d));

/** Simpan catatan (WhatsApp/web) lalu ekstrak datanya. */
export async function tambahCatatan(teks: string, opts: { pengirim?: string; asal?: Asal } = {}): Promise<Catatan> {
  const isi = rapi(teks, 8000);
  if (isi.length < 3) throw new Error("Catatan kosong.");
  const catatan: Catatan = {
    id: newId(),
    teks: isi,
    pengirim: rapi(opts.pengirim ?? "", 80),
    asal: opts.asal ?? "web",
    dibuat: now(),
    hasil: null,
  };
  try {
    const h = await ekstrak({ teks: isi, jenisLaporan: "Catatan", perihal: "", tanggal: catatan.dibuat, denganKejadian: true, catatan: true });
    catatan.hasil = await mutate((d) => {
      const t = terapkan(d, h, { sumberId: `catatan:${catatan.id}`, asal: catatan.asal, tanggal: catatan.dibuat, manual: true });
      d.catatan.unshift(catatan);
      return t;
    });
  } catch (e) {
    catatan.galat = e instanceof Error ? e.message : String(e);
    await mutate((d) => void d.catatan.unshift(catatan));
  }
  return catatan;
}
