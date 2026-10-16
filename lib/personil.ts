// Aturan murni untuk Data Personil (aman dipakai server maupun klien).

/** Urutan pangkat dari tertinggi, untuk pengurutan. Pangkat tidak dikenal diletakkan di akhir. */
export const URUTAN_PANGKAT = [
  "KOMBES", "AKBP", "KOMPOL", "AKP", "IPTU", "IPDA", "AIPTU", "AIPDA", "BRIPKA", "BRIGADIR", "BRIPTU", "BRIPDA",
  "PEMBINA", "PENATA", "PENGATUR", "JURU",
];

export const rankPangkat = (p: string) => {
  const i = URUTAN_PANGKAT.findIndex((x) => p.toUpperCase().startsWith(x));
  return i < 0 ? 99 : i;
};

export const UNIT_PERSONIL = [
  "Pimpinan",
  "Si Umum & Humas",
  "Si Propam",
  "SPKT",
  "Unit Intelkam",
  "Unit Reskrim",
  "Unit Binmas",
  "Unit Samapta",
  "Unit Lantas",
  "Lainnya",
] as const;

/** Turunkan unit kerja dari teks jabatan. */
export function unitDariJabatan(jabatan: string): string {
  const j = jabatan.toUpperCase();
  if (!j.trim()) return "Lainnya";
  if (/\bKAPOLSEK\b|WAKAPOLSEK/.test(j)) return "Pimpinan";
  if (/PROPAM/.test(j)) return "Si Propam";
  if (/KASIUM|TAHTI|TAUD|KASIHUMAS|HUMAS|\bBAUR\b|\bSIUM\b/.test(j)) return "Si Umum & Humas";
  if (/SPKT/.test(j)) return "SPKT";
  if (/INTELKAM/.test(j)) return "Unit Intelkam";
  if (/RESKRIM/.test(j)) return "Unit Reskrim";
  if (/BINMAS|BHABINKAMTIBMAS/.test(j)) return "Unit Binmas";
  if (/SAMAPTA|SABHARA/.test(j)) return "Unit Samapta";
  if (/LANTAS/.test(j)) return "Unit Lantas";
  return "Lainnya";
}

/** NRP Polri 8 digit; NIP PNS 18 digit. */
export const statusDariNomor = (nrp: string) => (nrp.replace(/\D/g, "").length >= 16 ? "PNS" : "Polri");
