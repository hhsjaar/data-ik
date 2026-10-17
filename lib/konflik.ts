import { jaccard, namaCocok, namaKey } from "./normalize";
import { now } from "./store";
import type { AlamatAlt, DbShape, Lokasi, Orang } from "./types";

// ---------- Alamat ----------

/** Bagian jalan dari alamat, dinormalkan (ejaan lama/baru disamakan). */
function jalan(alamat: string): { tokens: Set<string>; angka: Set<string> } | null {
  const seg = alamat.split(",").map((x) => x.trim());
  const j = seg.find((x) => /\b(jl|jln|jalan)\b/i.test(x));
  if (!j) return null;
  const t = j
    .toLowerCase()
    .replace(/\b(jalan|jln)\b/g, "jl")
    .replace(/oe/g, "u")
    .replace(/dj/g, "j")
    .replace(/dh/g, "d")
    .replace(/th/g, "t")
    .replace(/\bs\.?\s?h\.?\b/g, " ")
    .replace(/\b(no|nomor)\b\.?/g, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((x) => x && x !== "jl");
  return { tokens: new Set(t.filter((x) => !/^\d+[a-z]?$/.test(x))), angka: new Set(t.filter((x) => /^\d+[a-z]?$/.test(x))) };
}

/** Kunci stabil untuk menandai alamat yang ditolak. */
export const alamatKunci = (a: string) => {
  const j = jalan(a);
  return j ? [...j.tokens].sort().join(" ") + "|" + [...j.angka].sort().join(" ") : a.toLowerCase().replace(/[^a-z0-9]/g, "");
};

/** Dua alamat dianggap sama bila jalannya sama (nomor sama bila keduanya menyebut nomor). Alamat tanpa jalan tidak dipertentangkan. */
export function alamatSama(a: string, b: string): boolean {
  const ja = jalan(a);
  const jb = jalan(b);
  if (!ja || !jb) return true;
  if (ja.angka.size && jb.angka.size && ![...ja.angka].some((x) => jb.angka.has(x))) return false;
  const [kecil, besar] = ja.tokens.size <= jb.tokens.size ? [ja.tokens, jb.tokens] : [jb.tokens, ja.tokens];
  if (kecil.size >= 2 && [...kecil].every((x) => besar.has(x))) return true;
  return jaccard(ja.tokens, jb.tokens) >= 0.6;
}

/** Catat alamat bersaing pada lokasi (bila belum ditolak / sudah terverifikasi). */
export function catatAlternatif(l: Lokasi, alamat: string, sumber: string[], dari: AlamatAlt["dari"]) {
  if (!alamat || l.terverifikasi || alamatSama(l.alamat, alamat)) return;
  if (l.ditolak?.includes(alamatKunci(alamat))) return;
  l.alternatif ??= [];
  const ada = l.alternatif.find((x) => alamatSama(x.alamat, alamat));
  if (ada) {
    for (const s of sumber) if (!ada.sumber.includes(s)) ada.sumber.push(s);
    if (alamat.length > ada.alamat.length) ada.alamat = alamat;
  } else {
    l.alternatif.push({ alamat, sumber: [...sumber], dari });
  }
}

// ---------- Deteksi ----------

export type Pilihan = { kode: string; label: string };
export type Konflik = {
  id: string;
  jenis: "alamat" | "nama-mirip" | "jabatan-ganda";
  kind: "lokasi" | "orang";
  judul: string;
  pertanyaan: string;
  pilihan: Pilihan[];
};

const lev = (a: string, b: string) => {
  const m = a.length;
  const n = b.length;
  const d = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 1; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[m][n];
};

const tokenMirip = (x: string, y: string) => x === y || (x.length >= 5 && y.length >= 5 && lev(x, y) <= 1);

/** Nama mirip tetapi tidak otomatis digabung (mis. salah ketik / urutan beda). */
function namaMirip(ka: string, kb: string): boolean {
  const ta = ka.split(" ");
  const tb = kb.split(" ");
  const [kecil, besar] = ta.length <= tb.length ? [ta, tb] : [tb, ta];
  if (kecil.length < 2) return false;
  const cocok = kecil.filter((x) => besar.some((y) => tokenMirip(x, y))).length;
  return cocok >= 2 && cocok / kecil.length >= 0.75;
}

const JABATAN_TUNGGAL = /^(camat|sekcam|lurah|sekel|wali ?kota|wakil wali ?kota|gubernur|wakil gubernur|bupati|sekda|sekretaris daerah|rektor|dekan|kapolsek|danramil|presiden|menteri|kepala (dinas|badan|kantor|brida|bidang|seksi))\b/i;
const kunciJabatan = (j: string) => j.toLowerCase().replace(/walikota/g, "wali kota").replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();

const sudahDipastikanBeda = (a: Orang, b: Orang) => !!(a.bukanSama?.includes(b.id) || b.bukanSama?.includes(a.id));
const ringkasOrang = (o: Orang) => `${o.nama}${o.jabatan ? ` — ${o.jabatan}` : ""}`;

export function deteksiKonflik(db: DbShape): Konflik[] {
  const out: Konflik[] = [];

  // 1) Alamat bersaing pada satu lokasi
  for (const l of db.lokasi) {
    if (!l.alternatif?.length || l.terverifikasi) continue;
    const pilihan: Pilihan[] = [{ kode: "a0", label: `${l.alamat || "(kosong)"}${l.alamat_ai ? " [AI]" : ""} — alamat tercatat saat ini` }];
    l.alternatif.forEach((x, i) => pilihan.push({ kode: `a${i + 1}`, label: `${x.alamat} — disebut di ${x.sumber.length} ${x.dari === "catatan" ? "catatan" : "laporan"}` }));
    out.push({ id: `alamat:${l.id}`, jenis: "alamat", kind: "lokasi", judul: l.nama, pertanyaan: `Alamat ${l.nama} mana yang benar?`, pilihan });
  }

  // 2) Nama orang yang mirip tapi belum digabung
  const ok = db.orang.map((o) => ({ o, k: namaKey(o.nama) }));
  for (let i = 0; i < ok.length; i++) {
    for (let j = i + 1; j < ok.length; j++) {
      const a = ok[i];
      const b = ok[j];
      if (namaCocok(a.k, b.k) || sudahDipastikanBeda(a.o, b.o) || !namaMirip(a.k, b.k)) continue;
      out.push({
        id: `mirip:${a.o.id}:${b.o.id}`,
        jenis: "nama-mirip",
        kind: "orang",
        judul: `${a.o.nama} / ${b.o.nama}`,
        pertanyaan: `"${a.o.nama}" dan "${b.o.nama}" orang yang sama?`,
        pilihan: [
          { kode: "gabung-a", label: `Orang yang sama, pakai: ${ringkasOrang(a.o)}` },
          { kode: "gabung-b", label: `Orang yang sama, pakai: ${ringkasOrang(b.o)}` },
          { kode: "beda", label: "Bukan orang yang sama (dua orang berbeda)" },
        ],
      });
    }
  }

  // 3) Jabatan tunggal yang dipegang lebih dari satu nama
  const grup = new Map<string, Orang[]>();
  for (const o of db.orang) {
    if (o.kategori !== "pejabat") continue;
    const k = kunciJabatan(o.jabatan);
    if (!k || !JABATAN_TUNGGAL.test(k)) continue;
    grup.set(k, [...(grup.get(k) ?? []), o]);
  }
  for (const [k, orang] of grup) {
    if (orang.length < 2) continue;
    const semuaSudahBeda = orang.every((a, i) => orang.slice(i + 1).every((b) => sudahDipastikanBeda(a, b)));
    if (semuaSudahBeda) continue;
    // Bila ini hanya ejaan berbeda dari orang yang sama, tanyakan dulu sebagai "nama mirip".
    const semuaMirip = orang.every((a, i) => orang.slice(i + 1).every((b) => namaMirip(namaKey(a.nama), namaKey(b.nama)) || namaCocok(namaKey(a.nama), namaKey(b.nama))));
    if (semuaMirip) continue;
    out.push({
      id: `jabatan:${k}`,
      jenis: "jabatan-ganda",
      kind: "orang",
      judul: orang[0].jabatan,
      pertanyaan: `Siapa ${orang[0].jabatan} yang benar saat ini?`,
      pilihan: [
        ...orang.map((o) => ({ kode: `pilih:${o.id}`, label: `${o.nama} (terakhir disebut ${o.terakhir.slice(0, 10)}, ${o.sebutan}×)` })),
        { kode: "semua", label: "Semuanya benar (jabatan serupa, bukan orang yang sama)" },
      ],
    });
  }
  return out;
}

// ---------- Penyelesaian ----------

export type Hasil = { ok: boolean; pesan: string };
const gagal = (pesan: string): Hasil => ({ ok: false, pesan });

export function selesaikanKonflik(db: DbShape, id: string, kode: string, teksBaru?: string): Hasil {
  const waktu = now();
  const [jenis, ...sisa] = id.split(":");
  const rest = sisa.join(":");

  if (jenis === "alamat") {
    const l = db.lokasi.find((x) => x.id === rest);
    if (!l?.alternatif?.length) return gagal("Konflik alamat tidak ditemukan atau sudah selesai.");
    const kandidat = [l.alamat, ...l.alternatif.map((x) => x.alamat)];
    let dipilih: string;
    if (kode === "baru") {
      dipilih = (teksBaru ?? "").trim();
      if (dipilih.length < 8) return gagal("Alamat baru terlalu pendek.");
    } else {
      const m = kode.match(/^a(\d+)$/);
      const idx = m ? Number(m[1]) : -1;
      if (idx < 0 || idx >= kandidat.length) return gagal("Pilihan tidak dikenal.");
      dipilih = kandidat[idx];
    }
    l.ditolak = [...new Set([...(l.ditolak ?? []), ...kandidat.filter((a) => a && a !== dipilih).map(alamatKunci)])];
    l.alamat = dipilih;
    l.alternatif = [];
    delete l.alamat_ai;
    l.terverifikasi = true;
    l.manual = true;
    l.diubah = waktu;
    return { ok: true, pesan: `Alamat ${l.nama} ditetapkan: ${dipilih}` };
  }

  if (jenis === "mirip") {
    const [ia, ib] = rest.split(":");
    const a = db.orang.find((x) => x.id === ia);
    const b = db.orang.find((x) => x.id === ib);
    if (!a || !b) return gagal("Konflik nama tidak ditemukan atau sudah selesai.");
    if (kode === "beda") {
      a.bukanSama = [...new Set([...(a.bukanSama ?? []), b.id])];
      b.bukanSama = [...new Set([...(b.bukanSama ?? []), a.id])];
      a.diubah = b.diubah = waktu;
      return { ok: true, pesan: `${a.nama} dan ${b.nama} dicatat sebagai dua orang berbeda.` };
    }
    if (kode !== "gabung-a" && kode !== "gabung-b") return gagal("Pilihan tidak dikenal.");
    const [menang, kalah] = kode === "gabung-a" ? [a, b] : [b, a];
    menang.varian = [...new Set([...(menang.varian ?? []), kalah.nama, ...(kalah.varian ?? [])])].filter((x) => x !== menang.nama);
    for (const s of kalah.sumber) if (!menang.sumber.includes(s)) menang.sumber.push(s);
    menang.sebutan += kalah.sebutan;
    menang.instansi ||= kalah.instansi;
    menang.wilayah ||= kalah.wilayah;
    menang.rt ||= kalah.rt;
    menang.rw ||= kalah.rw;
    if (kalah.terakhir > menang.terakhir) menang.terakhir = kalah.terakhir;
    menang.terverifikasi = true;
    menang.manual = true;
    menang.diubah = waktu;
    db.orang = db.orang.filter((x) => x.id !== kalah.id);
    return { ok: true, pesan: `Digabung: "${kalah.nama}" menjadi "${menang.nama}".` };
  }

  if (jenis === "jabatan") {
    const orang = db.orang.filter((o) => o.kategori === "pejabat" && kunciJabatan(o.jabatan) === rest);
    if (orang.length < 2) return gagal("Konflik jabatan tidak ditemukan atau sudah selesai.");
    if (kode === "semua") {
      for (const a of orang) a.bukanSama = [...new Set([...(a.bukanSama ?? []), ...orang.filter((b) => b.id !== a.id).map((b) => b.id)])];
      return { ok: true, pesan: "Dicatat: semuanya benar, tidak akan ditanyakan lagi." };
    }
    const m = kode.match(/^pilih:(.+)$/);
    const terpilih = m ? orang.find((o) => o.id === m[1]) : undefined;
    if (!terpilih) return gagal("Pilihan tidak dikenal.");
    for (const o of orang) {
      if (o.id === terpilih.id) continue;
      if (!/^mantan\b/i.test(o.jabatan)) o.jabatan = `Mantan ${o.jabatan}`;
      o.manual = true;
      o.diubah = waktu;
    }
    terpilih.terverifikasi = true;
    terpilih.manual = true;
    terpilih.diubah = waktu;
    return { ok: true, pesan: `${terpilih.jabatan}: ${terpilih.nama}. Lainnya ditandai "Mantan".` };
  }
  return gagal("Jenis konflik tidak dikenal.");
}
