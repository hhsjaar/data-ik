// Jenis laporan dari tabel report_history (kolom template_type) di aplikasi pembuat-laporan.
export const JENIS_LAPORAN = [
  { key: "laporan-kegiatan", label: "Laporan Kegiatan", singkat: "Lapkeg", warna: "#2563eb" },
  { key: "laporan-informasi", label: "Laporan Informasi", singkat: "LI", warna: "#7c3aed" },
  { key: "laporan-harian-intelijen", label: "Laporan Harian Intelijen", singkat: "LHI", warna: "#0d9488" },
  { key: "laporan-harian-khusus", label: "Laporan Harian Khusus", singkat: "LHK", warna: "#d97706" },
  { key: "infosus", label: "Informasi Khusus", singkat: "Infosus", warna: "#dc2626" },
  { key: "rencana-kegiatan", label: "Rencana Kegiatan", singkat: "Renkeg", warna: "#0891b2" },
  { key: "laporan-harian", label: "Laporan Situasi Harian", singkat: "Lapsit", warna: "#64748b" },
] as const;

export type JenisKey = (typeof JENIS_LAPORAN)[number]["key"];

export function jenisInfo(key: string) {
  return (
    JENIS_LAPORAN.find((j) => j.key === key) ?? {
      key,
      label: key,
      singkat: key,
      warna: "#64748b",
    }
  );
}

export type ReportRow = {
  id: string;
  template_type: string;
  perihal: string;
  content: string;
  kapolsek_nama: string | null;
  meta_data: unknown;
  created_at: string;
};

export type ReportSummary = {
  id: string;
  jenis: string;
  perihal: string;
  tanggal: string; // ISO created_at
  ringkas: string;
  panjang: number;
};

// ---- Data khusus hasil olahan ----

export const KATEGORI_LOKASI = [
  "Pendidikan",
  "Kesehatan",
  "Pemerintahan",
  "Tempat Ibadah",
  "Pasar & Perdagangan",
  "Transportasi",
  "Objek Vital",
  "Wisata & Hiburan",
  "Permukiman & Fasilitas Umum",
  "Lainnya",
] as const;

export const KATEGORI_ORANG = [
  { key: "pejabat", label: "Pejabat Pemerintah" },
  { key: "tokoh-agama", label: "Tokoh Agama" },
  { key: "tokoh-masyarakat", label: "Tokoh Masyarakat" },
  { key: "rt-rw", label: "RT / RW" },
  { key: "ketua-lsm", label: "Ketua LSM" },
] as const;
export type KategoriOrang = (typeof KATEGORI_ORANG)[number]["key"];

export const TINGKAT_PEJABAT = [
  { key: "kementerian", label: "Kementerian / Pusat" },
  { key: "provinsi", label: "Provinsi" },
  { key: "kota", label: "Kota" },
  { key: "kecamatan", label: "Kecamatan" },
  { key: "kelurahan", label: "Kelurahan" },
  { key: "lainnya", label: "Lainnya" },
] as const;
export type TingkatPejabat = (typeof TINGKAT_PEJABAT)[number]["key"];

export const JENIS_KEJADIAN = [
  { key: "kecelakaan", label: "Kecelakaan" },
  { key: "kebakaran", label: "Kebakaran" },
  { key: "tanah-longsor", label: "Tanah Longsor" },
  { key: "penemuan-mayat", label: "Penemuan Mayat / Jenazah" },
  { key: "kriminalitas", label: "Kriminalitas" },
  { key: "bencana-lain", label: "Bencana Lain" },
  { key: "lainnya", label: "Lainnya" },
] as const;
export type JenisKejadian = (typeof JENIS_KEJADIAN)[number]["key"];

export type Asal = "laporan" | "whatsapp" | "web" | "manual";

type Dasar = {
  id: string;
  /** id laporan (report_history.id) yang menyebut data ini */
  sumber: string[];
  asal: Asal;
  /** true bila pernah diubah/dibuat tangan: tidak dihapus saat laporan diproses ulang */
  manual?: boolean;
  dibuat: string;
  diubah: string;
};

export type Lokasi = Dasar & {
  nama: string;
  alias: string[];
  kategori: string;
  alamat: string;
  /** true bila alamat diisi AI dari pengetahuan umum (bukan dari laporan) dan belum diverifikasi */
  alamat_ai?: boolean;
  kelurahan: string;
  keterangan: string;
  /** tanggal laporan terbaru yang menyebut tempat ini */
  terakhir: string;
  sebutan: number;
};

export type Orang = Dasar & {
  nama: string;
  kategori: KategoriOrang;
  tingkat: TingkatPejabat | "";
  jabatan: string;
  instansi: string;
  /** kelurahan / wilayah tugas */
  wilayah: string;
  rt: string;
  rw: string;
  keterangan: string;
  terakhir: string;
  sebutan: number;
};

export type Kejadian = Dasar & {
  jenis: JenisKejadian;
  judul: string;
  tanggal: string; // YYYY-MM-DD
  waktu: string;
  lokasi: string;
  uraian: string;
  akibat: string;
  tindak_lanjut: string;
};

export type Catatan = {
  id: string;
  teks: string;
  pengirim: string;
  asal: Asal;
  dibuat: string;
  hasil: { lokasi: number; orang: number; kejadian: number } | null;
  galat?: string;
};

export type Kind = "lokasi" | "orang" | "kejadian";

export type DbShape = {
  lokasi: Lokasi[];
  orang: Orang[];
  kejadian: Kejadian[];
  catatan: Catatan[];
  /** laporan yang sudah diproses ekstraksi */
  diproses: Record<string, { at: string; hash: string; lokasi: number; orang: number; kejadian: number }>;
};
