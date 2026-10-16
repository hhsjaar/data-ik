import { generateJson } from "./gemini";
import { rapi } from "./normalize";
import { mutate, readDb } from "./store";

const BATCH = 12;
const MAKS_GRUP = 4; // grup per panggilan, dijalankan paralel (muat di batas waktu serverless)

const skema = {
  type: "OBJECT",
  properties: {
    hasil: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: { nomor: { type: "INTEGER" }, alamat: { type: "STRING" }, yakin: { type: "BOOLEAN" } },
        required: ["nomor", "alamat", "yakin"],
      },
    },
  },
  required: ["hasil"],
};

const prompt = (daftar: string) => `Kamu membantu melengkapi alamat tempat-tempat di Kota Semarang, Jawa Tengah (terutama Kecamatan Tembalang).
Untuk setiap nomor, tulis alamat lengkap tempat itu HANYA bila kamu benar-benar yakin alamat tepatnya (nama jalan dan, bila diketahui, nomor/kelurahan/kecamatan). Format: "Jl. ... No. ..., Kelurahan ..., Kecamatan ..., Kota Semarang, Jawa Tengah".
Isi hanya untuk tempat terkenal/mudah diverifikasi yang nama jalannya benar-benar kamu ketahui (mis. kampus besar, rumah sakit, balai kota, mal, stasiun). Untuk sekolah bernomor (SD/SMP/SMA/SMK), puskesmas, kelurahan, masjid, pesantren, lapangan, atau tempat kecil lain, jawab kosong dengan yakin=false kecuali kamu sangat yakin. Bila tidak yakin, atau hanya menebak, isi alamat string kosong dan yakin=false. Jangan mengarang nomor jalan. Lebih baik kosong daripada salah.

${daftar}`;

type Hasil = { diperiksa: number; terisi: number; dilewati: number; sisa: number; galat: number };

/**
 * Isi alamat lokasi yang kosong dari pengetahuan umum Gemini. Hasil ditandai alamat_ai
 * (perlu verifikasi) dan tidak pernah menimpa alamat dari laporan. Dikerjakan per tahap:
 * panggil lagi selama `sisa` > 0. Lokasi yang sudah dicoba ditandai alamat_dicek agar tidak diulang.
 */
export async function lengkapiAlamat(): Promise<Hasil> {
  const db = await readDb();
  const semua = db.lokasi.filter((l) => !l.alamat && !l.alamat_dicek);
  const target = semua.slice(0, BATCH * MAKS_GRUP).map((l) => ({ id: l.id, nama: l.nama, kelurahan: l.kelurahan, kategori: l.kategori }));
  const grups: (typeof target)[] = [];
  for (let i = 0; i < target.length; i += BATCH) grups.push(target.slice(i, i + BATCH));
  let galat = 0;

  const hasil = await Promise.all(
    grups.map(async (grup) => {
      const daftar = grup.map((t, n) => `${n + 1}. ${t.nama}${t.kelurahan ? ` (Kelurahan ${t.kelurahan})` : ""} [${t.kategori}]`).join("\n");
      try {
        const out = await generateJson<{ hasil: { nomor: number; alamat: string; yakin: boolean }[] }>(prompt(daftar), skema);
        const peta = new Map(out.hasil.map((h) => [h.nomor, h]));
        const isian = grup.flatMap((t, n) => {
          const h = peta.get(n + 1);
          const alamat = rapi(h?.alamat, 400);
          return h?.yakin && alamat.length >= 12 ? [{ id: t.id, alamat }] : [];
        });
        return { grup, isian, ok: true };
      } catch {
        galat++;
        return { grup, isian: [] as { id: string; alamat: string }[], ok: false };
      }
    }),
  );

  const isian = new Map(hasil.flatMap((h) => h.isian).map((x) => [x.id, x.alamat]));
  const dicek = new Set(hasil.filter((h) => h.ok).flatMap((h) => h.grup.map((t) => t.id)));
  if (dicek.size) {
    await mutate((d) => {
      for (const l of d.lokasi) {
        if (!dicek.has(l.id) || l.alamat) continue;
        l.alamat_dicek = true;
        const a = isian.get(l.id);
        if (a) {
          l.alamat = a;
          l.alamat_ai = true;
          l.diubah = new Date().toISOString();
        }
      }
    });
  }
  return { diperiksa: dicek.size, terisi: isian.size, dilewati: dicek.size - isian.size, sisa: semua.length - dicek.size, galat };
}
