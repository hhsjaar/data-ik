import { generateJson } from "./gemini";
import { rapi } from "./normalize";
import { mutate, readDb } from "./store";

const BATCH = 12;

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

/**
 * Isi alamat lokasi yang kosong dari pengetahuan umum Gemini. Hasil ditandai alamat_ai
 * (perlu verifikasi) dan tidak pernah menimpa alamat dari laporan.
 */
export async function lengkapiAlamat(): Promise<{ diperiksa: number; terisi: number; dilewati: number; galat: number }> {
  const db = await readDb();
  const target = db.lokasi.filter((l) => !l.alamat).map((l) => ({ id: l.id, nama: l.nama, kelurahan: l.kelurahan, kategori: l.kategori }));
  let terisi = 0;
  let galat = 0;

  for (let i = 0; i < target.length; i += BATCH) {
    const grup = target.slice(i, i + BATCH);
    const daftar = grup.map((t, n) => `${n + 1}. ${t.nama}${t.kelurahan ? ` (Kelurahan ${t.kelurahan})` : ""} [${t.kategori}]`).join("\n");
    try {
      const out = await generateJson<{ hasil: { nomor: number; alamat: string; yakin: boolean }[] }>(
        `Kamu membantu melengkapi alamat tempat-tempat di Kota Semarang, Jawa Tengah (terutama Kecamatan Tembalang).
Untuk setiap nomor, tulis alamat lengkap tempat itu HANYA bila kamu benar-benar yakin alamat tepatnya (nama jalan dan, bila diketahui, nomor/kelurahan/kecamatan). Format: "Jl. ... No. ..., Kelurahan ..., Kecamatan ..., Kota Semarang, Jawa Tengah".
Isi hanya untuk tempat terkenal/mudah diverifikasi yang nama jalannya benar-benar kamu ketahui (mis. kampus besar, rumah sakit, balai kota, mal, stasiun). Untuk sekolah bernomor (SD/SMP/SMA/SMK), puskesmas, kelurahan, masjid, pesantren, lapangan, atau tempat kecil lain, jawab kosong dengan yakin=false kecuali kamu sangat yakin. Bila tidak yakin, atau hanya menebak, isi alamat string kosong dan yakin=false. Jangan mengarang nomor jalan. Lebih baik kosong daripada salah.

${daftar}`,
        skema,
      );
      const peta = new Map(out.hasil.map((h) => [h.nomor, h]));
      const isian = grup.flatMap((t, n) => {
        const h = peta.get(n + 1);
        const alamat = rapi(h?.alamat, 400);
        return h?.yakin && alamat.length >= 12 ? [{ id: t.id, alamat }] : [];
      });
      if (isian.length) {
        await mutate((d) => {
          for (const x of isian) {
            const l = d.lokasi.find((y) => y.id === x.id);
            if (l && !l.alamat) {
              l.alamat = x.alamat;
              l.alamat_ai = true;
              l.diubah = new Date().toISOString();
            }
          }
        });
        terisi += isian.length;
      }
    } catch {
      galat++;
    }
  }
  return { diperiksa: target.length, terisi, dilewati: target.length - terisi, galat };
}
