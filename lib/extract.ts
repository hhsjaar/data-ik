import { generateJson } from "./gemini";
import { jaccard, kunciKurung, namaCocok, namaKey, rapi, tempatKey, tempatSama, tokens } from "./normalize";
import { newId, now } from "./store";
import {
  JENIS_KEJADIAN,
  KATEGORI_LOKASI,
  KATEGORI_ORANG,
  TINGKAT_PEJABAT,
  type Asal,
  type DbShape,
  type JenisKejadian,
  type Kejadian,
  type Lokasi,
  type Orang,
} from "./types";

// ---------- Skema & prompt ----------

const str = { type: "STRING" };
const enumOf = (v: readonly string[]) => ({ type: "STRING", enum: [...v] });

function skema(denganKejadian: boolean) {
  const properties: Record<string, unknown> = {
    lokasi: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          nama: str,
          singkatan: str,
          kategori: enumOf(KATEGORI_LOKASI),
          alamat: str,
          kelurahan: str,
        },
        required: ["nama", "kategori"],
      },
    },
    orang: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          nama: str,
          kategori: enumOf(KATEGORI_ORANG.map((k) => k.key)),
          tingkat: enumOf(TINGKAT_PEJABAT.map((t) => t.key)),
          jabatan: str,
          instansi: str,
          wilayah: str,
          rt: str,
          rw: str,
        },
        required: ["nama", "kategori", "jabatan"],
      },
    },
  };
  if (denganKejadian) {
    properties.kejadian = {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          jenis: enumOf(JENIS_KEJADIAN.map((j) => j.key)),
          judul: str,
          tanggal: str,
          waktu: str,
          lokasi: str,
          uraian: str,
          akibat: str,
          tindak_lanjut: str,
        },
        required: ["jenis", "judul", "uraian"],
      },
    };
  }
  return { type: "OBJECT", properties, required: ["lokasi", "orang", ...(denganKejadian ? ["kejadian"] : [])] };
}

const ATURAN_UMUM = `Kamu adalah analis data untuk Unit Intelkam Polsek Tembalang, Polrestabes Semarang. Tugasmu mengekstrak data khusus dari teks laporan secara AKURAT. Wilayah kerja: Kecamatan Tembalang, Kota Semarang, Jawa Tengah.

ATURAN UMUM
- Hanya ambil yang TERTULIS di teks. Dilarang mengarang, menebak, atau menambah dari pengetahuan sendiri (terutama alamat, jabatan, nama).
- Kalau tidak ada, kembalikan array kosong. Lebih baik sedikit tapi benar.
- Jangan menduplikasi: satu entitas satu entri, walau disebut berulang.

1) LOKASI / TEMPAT PENTING (array "lokasi")
- Hanya tempat penting yang berada di wilayah Kota Semarang (terutama Kecamatan Tembalang) dan punya identitas/nama khusus: kampus/universitas/sekolah/pesantren, rumah sakit/puskesmas/klinik, kantor pemerintahan (kantor kecamatan/kelurahan/dinas/balai kota/gubernuran/DPRD), tempat ibadah (masjid, gereja, pura, vihara) dengan nama jelas, pasar/mal/hotel/apartemen, terminal/stasiun/gerbang tol, SPBU/depo/pabrik/perusahaan/objek vital dengan nama atau nomor spesifik, gedung/aula/stadion/dome/GOR/lapangan besar tempat acara dengan nama jelas, tempat wisata/hiburan.
- BUKAN lokasi penting (jangan dimasukkan): nama jalan, perempatan/pertigaan/bundaran/persimpangan, kelurahan/kecamatan/kota saja, rumah warga, ruangan/lantai/laboratorium/fakultas/gedung kecil di dalam kampus (cukup ambil kampusnya), "SPBU"/"masjid"/"pasar" tanpa nama spesifik, tempat di luar Kota Semarang (mis. di Jakarta atau kota lain), kantor Polri sendiri, nama kementerian/lembaga pusat sebagai sekadar institusi.
- "nama": nama lengkap resmi, tanpa alamat. "singkatan": singkatan/nama populer bila tertulis (mis. Undip), kalau tidak ada kosongkan.
- "alamat": alamat lengkap HANYA bila tertulis di teks, ditulis rapi berurutan: "Jl. ... No. ..., Kelurahan ..., Kecamatan ..., Kota Semarang, Jawa Tengah" (sesuai teks, jangan dilengkapi dari ingatan). Kosongkan bila tidak tertulis. "kelurahan": kelurahan bila tertulis.

2) ORANG PENTING (array "orang")
- Hanya orang yang disebut dengan NAMA dan memegang jabatan/kedudukan penting SAAT INI. Tulis nama dengan huruf kapital di awal kata beserta gelar (mis. "H. Ganjar Pranowo, S.H., M.I.P.").
- Kategori:
  * "pejabat": pejabat pemerintahan/negara/lembaga negara/TNI (presiden, menteri, kepala badan/dinas, gubernur, wali kota, wakil, sekda, anggota DPR/DPRD, camat, lurah, danramil, direktur BUMN, rektor dan dekan perguruan tinggi negeri, dsb). Isi "tingkat": kementerian (pusat/nasional), provinsi, kota, kecamatan, kelurahan, atau lainnya.
  * "tokoh-agama": kyai/ulama/ustadz, pimpinan pondok pesantren, pendeta/pastor/bhikkhu/pandita, ketua takmir/DKM, pengurus MUI/NU/Muhammadiyah/FKUB.
  * "tokoh-masyarakat": tokoh masyarakat/adat/pemuda, ketua paguyuban/komunitas/organisasi masyarakat, ketua/presiden organisasi kemahasiswaan atau kepemudaan (BEM, DEMA, IMM, HMI, PMII, GMNI, dsb), pengusaha/pimpinan perusahaan berpengaruh.
  * "rt-rw": Ketua RT atau Ketua RW; isi "rt", "rw" (angka saja, mis. "03") dan "wilayah" (kelurahan) bila tertulis.
  * "ketua-lsm": ketua/pimpinan/direktur LSM atau ormas sejenis; tulis nama LSM di "instansi".
- "jabatan": jabatan struktural utama persis seperti di teks (tulis "Mantan ..." bila tertulis mantan). Utamakan jabatan struktural daripada peran sesaat di acara (khatib, imam, pembicara).
- BUKAN orang penting (jangan dimasukkan): anggota Polri (Kapolsek, Kapolrestabes, Kapolda, Kanit, pangkat Aipda/Bripka/Kompol/Irjen dll) termasuk pembuat/penandatangan laporan; korban, tersangka/pelaku, saksi, warga biasa; panitia, moderator, MC, narahubung, perwakilan, koordinator lapangan, sekretaris/anggota/pengurus biasa organisasi, peserta, mahasiswa perorangan; narasumber/pakar/dosen/aktivis biasa tanpa jabatan struktural penting; tokoh sejarah atau yang sudah wafat yang hanya disebut sebagai rujukan; orang tanpa nama.`;

const ATURAN_KEJADIAN = `
3) KEJADIAN MENONJOL (array "kejadian")
- Hanya kejadian NYATA yang benar-benar TERJADI dan ditangani/dilaporkan: kecelakaan (lalu lintas/kerja), kebakaran, tanah longsor, penemuan mayat/jenazah, kriminalitas (pencurian, curanmor, penganiayaan, pembegalan, tawuran, narkoba, penipuan, dsb), bencana lain (banjir, pohon tumbang, angin kencang), atau kejadian menonjol lain yang jelas.
- JANGAN masukkan: himbauan/pencegahan ("mengantisipasi curanmor"), pernyataan "kejadian menonjol nihil", statistik umum, potensi/ancaman, kegiatan rutin pengamanan acara tanpa insiden.
- "jenis": pilih yang paling sesuai ("lainnya" bila tidak cocok). "judul": ringkas (maks 12 kata). "tanggal": YYYY-MM-DD dari teks (kosongkan bila tak jelas). "waktu": jam bila tertulis. "lokasi": tempat kejadian selengkap tertulis. "uraian": 1-3 kalimat apa yang terjadi. "akibat": korban/kerugian bila tertulis. "tindak_lanjut": penanganan oleh petugas bila tertulis.`;

export type HasilEkstraksi = {
  lokasi?: Array<Record<string, string>>;
  orang?: Array<Record<string, string>>;
  kejadian?: Array<Record<string, string>>;
};

const MAKS_TEKS = 45_000;

export async function ekstrak(opts: {
  teks: string;
  jenisLaporan: string;
  perihal: string;
  tanggal: string;
  denganKejadian: boolean;
  catatan?: boolean;
}): Promise<HasilEkstraksi> {
  const konteks = opts.catatan
    ? `Sumber: catatan singkat dari pemilik (Unit Intelkam) lewat WhatsApp/web. Anggap isinya benar dan penting; catat semua tempat/orang/kejadian yang disebut walau singkat. Tanggal catatan: ${opts.tanggal.slice(0, 10)}.`
    : `Sumber: laporan jenis "${opts.jenisLaporan}" tertanggal ${opts.tanggal.slice(0, 10)}. Perihal: ${opts.perihal}`;
  const prompt = `${ATURAN_UMUM}${opts.denganKejadian ? ATURAN_KEJADIAN : ""}

${konteks}

=== ISI ===
${opts.teks.slice(0, MAKS_TEKS)}
=== AKHIR ===`;
  return generateJson<HasilEkstraksi>(prompt, skema(opts.denganKejadian));
}

// ---------- Penerapan ke penyimpanan ----------

// Peran sesaat di acara bukan jabatan penting.
const PERAN_DITOLAK = /\b(panitia|moderator|narahubung|pembawa acara|MC|peserta|perwakilan|koordinator lapangan|korlap|pemantik|notulen)\b/i;

export type Konteks = {
  sumberId: string;
  asal: Asal;
  tanggal: string; // ISO
  manual: boolean;
};

const oneOf = <T extends string>(v: string, daftar: readonly T[], def: T): T =>
  (daftar as readonly string[]).includes(v) ? (v as T) : def;

/** Cabut kontribusi satu sumber (sebelum diproses ulang). */
export function cabutSumber(db: DbShape, sumberId: string, hapusManual = false) {
  const bersihkan = <T extends { sumber: string[]; manual?: boolean; asal: string }>(arr: T[]) =>
    arr.filter((e) => {
      if (!e.sumber.includes(sumberId)) return true;
      e.sumber = e.sumber.filter((s) => s !== sumberId);
      if (e.sumber.length > 0) return true;
      return hapusManual ? e.asal === "manual" : !!e.manual;
    });
  db.lokasi = bersihkan(db.lokasi);
  db.orang = bersihkan(db.orang);
  db.kejadian = bersihkan(db.kejadian);
}

const tgl = (iso: string) => iso.slice(0, 10);
const lebihBaru = (a: string, b: string) => tgl(a) >= tgl(b);

export function terapkan(db: DbShape, h: HasilEkstraksi, k: Konteks) {
  const hitung = { lokasi: 0, orang: 0, kejadian: 0 };
  const waktu = now();
  const dasar = () => ({ sumber: [k.sumberId], asal: k.asal, ...(k.manual ? { manual: true } : {}), dibuat: waktu, diubah: waktu });

  // Lokasi
  for (const r of h.lokasi ?? []) {
    const nama = rapi(r.nama, 200);
    if (nama.length < 3) continue;
    const alias = [rapi(r.singkatan, 80), ...kunciKurung(nama)].filter(Boolean);
    const keys = new Set([tempatKey(nama), ...alias.map(tempatKey)].filter((x) => x.length >= 2));
    const ada = db.lokasi.find((l) => [l.nama, ...l.alias].some((n) => keys.has(tempatKey(n))));
    const alamat = rapi(r.alamat, 400);
    if (ada) {
      if (!ada.sumber.includes(k.sumberId)) {
        ada.sumber.push(k.sumberId);
        ada.sebutan++;
      }
      if ((!ada.alamat || ada.alamat_ai) && alamat) {
        ada.alamat = alamat;
        delete ada.alamat_ai;
      }
      else if (alamat && ada.alamat && alamat.length > ada.alamat.length + 15 && !ada.manual) ada.alamat = alamat;
      if (!ada.kelurahan) ada.kelurahan = rapi(r.kelurahan, 80);
      if (ada.kategori === "Lainnya") ada.kategori = oneOf(r.kategori, KATEGORI_LOKASI, "Lainnya");
      for (const a of alias) if (!ada.alias.some((x) => tempatKey(x) === tempatKey(a)) && tempatKey(a) !== tempatKey(ada.nama)) ada.alias.push(a);
      if (lebihBaru(k.tanggal, ada.terakhir)) ada.terakhir = k.tanggal;
      ada.diubah = waktu;
    } else {
      const baru: Lokasi = {
        id: newId(),
        ...dasar(),
        nama,
        alias: alias.filter((a) => tempatKey(a) !== tempatKey(nama)),
        kategori: oneOf(r.kategori, KATEGORI_LOKASI, "Lainnya"),
        alamat,
        kelurahan: rapi(r.kelurahan, 80),
        keterangan: "",
        terakhir: k.tanggal,
        sebutan: 1,
      };
      db.lokasi.push(baru);
      hitung.lokasi++;
    }
  }

  // Orang
  for (const r of h.orang ?? []) {
    const nama = rapi(r.nama, 160);
    const key = namaKey(nama);
    if (key.length < 3 || !rapi(r.jabatan) || PERAN_DITOLAK.test(r.jabatan)) continue;
    const kategori = oneOf(r.kategori, KATEGORI_ORANG.map((c) => c.key), "tokoh-masyarakat");
    const tingkat = kategori === "pejabat" ? oneOf(r.tingkat, TINGKAT_PEJABAT.map((t) => t.key), "lainnya") : "";
    const ada = db.orang.find((o) => namaCocok(namaKey(o.nama), key));
    if (ada) {
      if (!ada.sumber.includes(k.sumberId)) {
        ada.sumber.push(k.sumberId);
        ada.sebutan++;
      }
      // Jabatan dari laporan terbaru yang dipakai; data yang diubah tangan tidak ditimpa.
      if (!ada.manual && lebihBaru(k.tanggal, ada.terakhir)) {
        ada.jabatan = rapi(r.jabatan, 200) || ada.jabatan;
        ada.kategori = kategori;
        if (tingkat) ada.tingkat = tingkat;
        ada.instansi = rapi(r.instansi, 200) || ada.instansi;
        ada.wilayah = rapi(r.wilayah, 100) || ada.wilayah;
        ada.rt = rapi(r.rt, 6) || ada.rt;
        ada.rw = rapi(r.rw, 6) || ada.rw;
      } else {
        ada.instansi ||= rapi(r.instansi, 200);
        ada.wilayah ||= rapi(r.wilayah, 100);
        ada.rt ||= rapi(r.rt, 6);
        ada.rw ||= rapi(r.rw, 6);
      }
      if (lebihBaru(k.tanggal, ada.terakhir)) ada.terakhir = k.tanggal;
      if (nama.length > ada.nama.length && namaKey(nama) === namaKey(ada.nama) && !ada.manual) ada.nama = nama;
      ada.diubah = waktu;
    } else {
      const baru: Orang = {
        id: newId(),
        ...dasar(),
        nama,
        kategori,
        tingkat,
        jabatan: rapi(r.jabatan, 200),
        instansi: rapi(r.instansi, 200),
        wilayah: rapi(r.wilayah, 100),
        rt: rapi(r.rt, 6),
        rw: rapi(r.rw, 6),
        keterangan: "",
        terakhir: k.tanggal,
        sebutan: 1,
      };
      db.orang.push(baru);
      hitung.orang++;
    }
  }

  // Kejadian
  for (const r of h.kejadian ?? []) {
    const judul = rapi(r.judul, 200);
    const uraian = rapi(r.uraian, 1500);
    if (!judul || !uraian) continue;
    const jenis = oneOf<JenisKejadian>(r.jenis, JENIS_KEJADIAN.map((j) => j.key), "lainnya");
    const tanggal = /^\d{4}-\d{2}-\d{2}$/.test(r.tanggal ?? "") ? r.tanggal : tgl(k.tanggal);
    const lokasi = rapi(r.lokasi, 300);
    const tk = tokens(`${judul} ${lokasi}`);
    const ada = db.kejadian.find((e) => e.jenis === jenis && e.tanggal === tanggal && jaccard(tk, tokens(`${e.judul} ${e.lokasi}`)) >= 0.35);
    if (ada) {
      if (!ada.sumber.includes(k.sumberId)) ada.sumber.push(k.sumberId);
      ada.akibat ||= rapi(r.akibat, 500);
      ada.tindak_lanjut ||= rapi(r.tindak_lanjut, 800);
      ada.waktu ||= rapi(r.waktu, 40);
      ada.diubah = waktu;
    } else {
      const baru: Kejadian = {
        id: newId(),
        ...dasar(),
        jenis,
        judul,
        tanggal,
        waktu: rapi(r.waktu, 40),
        lokasi,
        uraian,
        akibat: rapi(r.akibat, 500),
        tindak_lanjut: rapi(r.tindak_lanjut, 800),
      };
      db.kejadian.push(baru);
      hitung.kejadian++;
    }
  }
  return hitung;
}

// ---------- Perapian: gabungkan duplikat ----------

type Gabung = { sumber: string[]; manual?: boolean; sebutan?: number; diubah: string };

function pilihMenang<T extends Gabung>(a: T, b: T, nama: (x: T) => string): [T, T] {
  if (!!a.manual !== !!b.manual) return a.manual ? [a, b] : [b, a];
  const sa = a.sebutan ?? 0;
  const sb = b.sebutan ?? 0;
  if (sa !== sb) return sa > sb ? [a, b] : [b, a];
  return nama(a).length <= nama(b).length ? [a, b] : [b, a];
}

/** Gabungkan lokasi & orang yang sebenarnya sama. Mengembalikan jumlah yang digabung. */
export function rapikan(db: DbShape) {
  let lokasi = 0;
  let orang = 0;
  const sebelum = db.orang.length;
  db.orang = db.orang.filter((o) => o.manual || !PERAN_DITOLAK.test(o.jabatan));
  const dibuang = sebelum - db.orang.length;

  const L: Lokasi[] = [];
  for (const l of db.lokasi) {
    const dup = L.find((x) => [x.nama, ...x.alias].some((a) => [l.nama, ...l.alias].some((b) => tempatKey(a) === tempatKey(b) || tempatSama(a, b))));
    if (!dup) {
      L.push(l);
      continue;
    }
    const [menang, kalah] = pilihMenang(dup, l, (x) => x.nama);
    for (const s of kalah.sumber) if (!menang.sumber.includes(s)) menang.sumber.push(s);
    menang.sebutan = menang.sumber.length || menang.sebutan + kalah.sebutan;
    if (!menang.alamat || (menang.alamat_ai && kalah.alamat && !kalah.alamat_ai)) {
      menang.alamat = kalah.alamat;
      if (kalah.alamat_ai) menang.alamat_ai = true;
      else delete menang.alamat_ai;
    }
    if (!menang.kelurahan) menang.kelurahan = kalah.kelurahan;
    if (menang.kategori === "Lainnya") menang.kategori = kalah.kategori;
    for (const a of [kalah.nama, ...kalah.alias]) if (tempatKey(a) !== tempatKey(menang.nama) && !menang.alias.some((x) => tempatKey(x) === tempatKey(a))) menang.alias.push(a);
    if (kalah.terakhir > menang.terakhir) menang.terakhir = kalah.terakhir;
    menang.diubah = now();
    L[L.indexOf(dup)] = menang;
    lokasi++;
  }
  // Kelurahan mengikuti alamat bila alamat menyebutnya (lebih tepercaya daripada isian terpisah).
  for (const l of L) {
    const m = l.alamat.match(/\bKel(?:urahan|\.)?\s+([A-Z][A-Za-z' ]+?)(?:,|\s+Kec|$)/);
    if (m && !l.manual) l.kelurahan = m[1].trim();
  }
  db.lokasi = L;

  const O: Orang[] = [];
  for (const o of db.orang) {
    const key = namaKey(o.nama);
    const dup = O.find((x) => namaCocok(namaKey(x.nama), key));
    if (!dup) {
      O.push(o);
      continue;
    }
    const [menang, kalah] = pilihMenang(dup, o, (x) => x.nama);
    for (const s of kalah.sumber) if (!menang.sumber.includes(s)) menang.sumber.push(s);
    menang.sebutan = Math.max(menang.sumber.length, menang.sebutan + kalah.sebutan);
    if (kalah.terakhir > menang.terakhir && !menang.manual) {
      menang.jabatan = kalah.jabatan;
      menang.kategori = kalah.kategori;
      menang.tingkat = kalah.tingkat;
      menang.terakhir = kalah.terakhir;
    }
    menang.instansi ||= kalah.instansi;
    menang.wilayah ||= kalah.wilayah;
    menang.rt ||= kalah.rt;
    menang.rw ||= kalah.rw;
    if (kalah.nama.length > menang.nama.length && !menang.manual) menang.nama = kalah.nama;
    menang.diubah = now();
    O[O.indexOf(dup)] = menang;
    orang++;
  }
  db.orang = O;
  return { lokasi, orang, dibuang };
}
