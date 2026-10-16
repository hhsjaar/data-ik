import { cabutSumber, ekstrak, rapikan, terapkan, type HasilEkstraksi } from "./extract";
import { geminiConfigured } from "./gemini";
import { rapi } from "./normalize";
import { hashText, loadReports } from "./reports";
import { mutate, newId, now, readDb } from "./store";
import { jenisInfo, type Asal, type Catatan, type DbShape, type ReportRow } from "./types";

// Sinkronisasi dikerjakan per tahap pendek (cocok untuk fungsi serverless seperti Vercel):
// satu panggilan memproses beberapa laporan dalam batas waktu, klien memanggil lagi sampai `sisa` = 0.

const PARALEL = 4;
const ANGGARAN_MS = 35_000;
const MAKS_PER_PANGGILAN = 24;

const perlu = (db: DbShape, r: ReportRow, gen?: string) => {
  const d = db.diproses[r.id];
  return !d || d.hash !== hashText(r.content || "") || (!!gen && d.gen !== gen);
};

/** Hitung berapa laporan yang belum/berubah sejak diproses. */
export async function hitungAntrean() {
  const [rows, db] = await Promise.all([loadReports(), readDb()]);
  const antre = rows.filter((r) => perlu(db, r)).length;
  return { totalLaporan: rows.length, antre, sudah: rows.length - antre };
}

export type LangkahHasil = {
  diproses: number;
  baru: { lokasi: number; orang: number; kejadian: number };
  galat: Array<{ id: string; pesan: string }>;
  sisa: number;
  total: number;
  selesai: boolean;
};

/**
 * Proses sebagian laporan yang belum diolah. `gen` (opsional) memaksa pemrosesan ulang semua laporan
 * satu kali per nilai gen (mis. cap waktu dari klien).
 */
export async function langkahSync(opts: { gen?: string } = {}): Promise<LangkahHasil> {
  if (!geminiConfigured()) throw new Error("GEMINI_API_KEY belum diisi.");
  const mulai = Date.now();
  const [rows, db0] = await Promise.all([loadReports(true), readDb()]);
  const antre = rows.filter((r) => perlu(db0, r, opts.gen)).sort((a, b) => a.created_at.localeCompare(b.created_at)); // lama -> baru
  const hasil: LangkahHasil = { diproses: 0, baru: { lokasi: 0, orang: 0, kejadian: 0 }, galat: [], sisa: antre.length, total: rows.length, selesai: false };

  let i = 0;
  while (i < antre.length && i < MAKS_PER_PANGGILAN && Date.now() - mulai < ANGGARAN_MS) {
    const grup = antre.slice(i, i + PARALEL);
    i += grup.length;
    const ekstraksi = await Promise.all(
      grup.map(async (r): Promise<[ReportRow, HasilEkstraksi | Error]> => {
        try {
          return [
            r,
            await ekstrak({
              teks: r.content || "",
              jenisLaporan: jenisInfo(r.template_type).label,
              perihal: r.perihal || "",
              tanggal: r.created_at,
              denganKejadian: r.template_type === "laporan-kegiatan",
            }),
          ];
        } catch (e) {
          return [r, e instanceof Error ? e : new Error(String(e))];
        }
      }),
    );
    const berhasil = ekstraksi.filter((x): x is [ReportRow, HasilEkstraksi] => !(x[1] instanceof Error));
    for (const [r, h] of ekstraksi) if (h instanceof Error) hasil.galat.push({ id: r.id, pesan: h.message.slice(0, 200) });
    if (berhasil.length) {
      await mutate((d) => {
        for (const [r, h] of berhasil) {
          cabutSumber(d, r.id);
          const t = terapkan(d, h, { sumberId: r.id, asal: "laporan", tanggal: r.created_at, manual: false });
          d.diproses[r.id] = { at: now(), hash: hashText(r.content || ""), gen: opts.gen, ...t };
          hasil.baru.lokasi += t.lokasi;
          hasil.baru.orang += t.orang;
          hasil.baru.kejadian += t.kejadian;
        }
      });
      hasil.diproses += berhasil.length;
    }
  }
  hasil.sisa = Math.max(0, antre.length - hasil.diproses);
  // Gabungkan duplikat setelah tahap terakhir (atau bila tidak ada lagi yang bisa diproses).
  if (hasil.sisa === 0 || hasil.diproses === 0) {
    await mutate((d) => void rapikan(d));
    hasil.selesai = hasil.sisa === 0;
  }
  return hasil;
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

/**
 * Impor daftar personil dari Excel. Dicocokkan berdasarkan NRP/NIP (atau nama bila NRP kosong):
 * yang ada diperbarui (kecuali yang pernah diubah tangan), yang baru ditambah, dan baris asal Excel yang
 * tidak ada lagi di file dihapus (mis. personil dimutasi). Baris input manual tidak disentuh.
 */
export async function imporPersonil(baris: import("./excel-personil").BarisPersonil[]) {
  return mutate((d) => {
    const waktu = now();
    const kunci = (x: { nrp: string; nama: string }) => (x.nrp ? `n:${x.nrp}` : `m:${x.nama.toLowerCase()}`);
    const adaDiFile = new Set(baris.map(kunci));
    const peta = new Map(d.personil.filter((p) => p.asal === "excel").map((p) => [kunci(p), p]));
    let baru = 0;
    let diperbarui = 0;
    for (const b of baris) {
      const ada = peta.get(kunci(b));
      if (ada) {
        ada.no = b.no;
        if (!ada.manual) Object.assign(ada, { nama: b.nama, pangkat: b.pangkat, nrp: b.nrp, jabatan: b.jabatan, unit: b.unit, status: b.status, keterangan: b.keterangan });
        ada.diubah = waktu;
        diperbarui++;
      } else {
        d.personil.push({ id: newId(), ...b, asal: "excel", dibuat: waktu, diubah: waktu });
        baru++;
      }
    }
    const sebelum = d.personil.length;
    d.personil = d.personil.filter((p) => p.asal !== "excel" || p.manual || adaDiFile.has(kunci(p)));
    d.personil.sort((a, b) => a.no - b.no);
    return { total: baris.length, baru, diperbarui, dihapus: sebelum - d.personil.length };
  });
}
