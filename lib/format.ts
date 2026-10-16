import { JENIS_KEJADIAN, KATEGORI_ORANG, TINGKAT_PEJABAT, type Kejadian, type Lokasi, type Orang } from "./types";

const labelOf = (arr: readonly { key: string; label: string }[], key: string) => arr.find((a) => a.key === key)?.label ?? key;
export const labelOrang = (k: string) => labelOf(KATEGORI_ORANG, k);
export const labelTingkat = (k: string) => labelOf(TINGKAT_PEJABAT, k);
export const labelKejadian = (k: string) => labelOf(JENIS_KEJADIAN, k);

const titik = (s: string) => (/[.!?]$/.test(s) ? s : `${s}.`);

/** Format baris: "- Alamat <nama> berlokasi di <alamat>" */
export function barisLokasi(l: Pick<Lokasi, "nama" | "alamat" | "alamat_ai">) {
  return l.alamat ? `- Alamat ${l.nama} berlokasi di ${titik(l.alamat)}${l.alamat_ai ? " (perlu verifikasi)" : ""}` : `- ${l.nama} (alamat belum tercatat)`;
}

export function barisOrang(o: Orang) {
  const rtrw = o.kategori === "rt-rw" && !/\b(RT|RW)\b/i.test(o.jabatan) ? [o.rt && `RT ${o.rt}`, o.rw && `RW ${o.rw}`].filter(Boolean).join(" / ") : "";
  const bagian = [o.jabatan, rtrw, o.wilayah, o.instansi].filter(Boolean);
  const tambah = [...new Set(bagian)].join(", ");
  return tambah ? `- ${o.nama} (${tambah})` : `- ${o.nama}`;
}

export function barisKejadian(e: Kejadian) {
  const tgl = e.tanggal ? new Date(`${e.tanggal}T00:00:00`).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" }) : "";
  return `- ${labelKejadian(e.jenis)}${tgl ? `, ${tgl}` : ""}${e.waktu ? ` pukul ${e.waktu}` : ""}${e.lokasi ? ` di ${e.lokasi}` : ""}: ${e.uraian}${e.akibat ? ` Akibat: ${titik(e.akibat)}` : ""}`;
}
