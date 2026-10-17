import { barisLokasi } from "./format";
import { namaKey, tempatKey } from "./normalize";
import { readDb } from "./store";
import type { Lokasi, Orang, Personil } from "./types";

export type Saran = {
  kind: "lokasi" | "orang" | "personil";
  id: string;
  /** teks yang disarankan untuk diisikan ke kolom */
  nilai: string;
  /** keterangan pendamping (alamat / jabatan) */
  detail: string;
  terverifikasi: boolean;
};

const skor = (kandidat: string[], q: string): number => {
  let best = 0;
  for (const c of kandidat) {
    const t = c.toLowerCase();
    if (t === q) best = Math.max(best, 5);
    else if (t.startsWith(q)) best = Math.max(best, 4);
    else if (t.split(/[\s,.()/-]+/).some((w) => w.startsWith(q))) best = Math.max(best, 3);
    else if (t.includes(q)) best = Math.max(best, 2);
  }
  return best;
};

/** Rekomendasi ala pencarian Google untuk kolom isian: awalan kata > mengandung; terverifikasi & sering disebut lebih atas. */
export async function saran(kind: Saran["kind"], qRaw: string, limit = 8): Promise<Saran[]> {
  const q = qRaw.toLowerCase().trim();
  if (q.length < 2) return [];
  const db = await readDb();
  const hasil: (Saran & { s: number; n: number })[] = [];
  if (kind === "lokasi") {
    for (const l of db.lokasi) {
      const s = skor([l.nama, ...l.alias], q);
      if (s) hasil.push({ kind, id: l.id, nilai: l.nama, detail: l.alamat, terverifikasi: !!l.terverifikasi, s, n: l.sebutan });
    }
  } else if (kind === "orang") {
    for (const o of db.orang) {
      const s = skor([o.nama, ...(o.varian ?? []), o.jabatan], q);
      if (s) hasil.push({ kind, id: o.id, nilai: o.nama, detail: o.jabatan, terverifikasi: !!o.terverifikasi, s, n: o.sebutan });
    }
  } else {
    for (const p of db.personil) {
      const s = skor([p.nama, p.nrp, p.jabatan], q);
      if (s) hasil.push({ kind, id: p.id, nilai: `${p.pangkat} ${p.nama}`.trim(), detail: p.jabatan, terverifikasi: true, s, n: 0 });
    }
  }
  return hasil
    .sort((a, b) => b.s - a.s || Number(b.terverifikasi) - Number(a.terverifikasi) || b.n - a.n || a.nilai.localeCompare(b.nilai, "id"))
    .slice(0, Math.min(limit, 20))
    .map(({ s: _s, n: _n, ...x }) => (void _s, void _n, x));
}

export type Acuan = {
  kind: "lokasi" | "orang";
  id: string;
  /** penulisan baku yang dianjurkan */
  baku: string;
  detail: string;
  terverifikasi: boolean;
  /** potongan teks yang cocok */
  ditemukan: string;
  /** true bila di teks tertulis dengan ejaan lain dari penulisan baku */
  ejaanBeda: boolean;
};

const norm = (s: string) => ` ${s.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim()} `;

/** Cari nama tempat/orang yang disebut dalam sebuah teks dan kembalikan penulisan bakunya (untuk acuan pembuat laporan). */
export async function acuan(teks: string, opsi: { hanyaTerverifikasi?: boolean } = {}): Promise<Acuan[]> {
  const t = norm(teks);
  const db = await readDb();
  const out: Acuan[] = [];
  const pakai = <T extends { terverifikasi?: boolean }>(x: T) => !opsi.hanyaTerverifikasi || x.terverifikasi;

  for (const l of db.lokasi as Lokasi[]) {
    if (!pakai(l)) continue;
    for (const n of [l.nama, ...l.alias]) {
      const k = tempatKey(n);
      if (k.length < 4 || !t.includes(` ${k} `)) continue;
      out.push({ kind: "lokasi", id: l.id, baku: l.nama, detail: l.alamat, terverifikasi: !!l.terverifikasi, ditemukan: n, ejaanBeda: tempatKey(l.nama) !== k });
      break;
    }
  }
  for (const o of db.orang as Orang[]) {
    if (!pakai(o)) continue;
    for (const n of [o.nama, ...(o.varian ?? [])]) {
      const k = namaKey(n);
      if (k.split(" ").length < 2 || !t.includes(` ${k} `)) continue;
      out.push({ kind: "orang", id: o.id, baku: o.nama, detail: o.jabatan, terverifikasi: !!o.terverifikasi, ditemukan: n, ejaanBeda: namaKey(o.nama) !== k });
      break;
    }
  }
  return out;
}

export const barisAcuan = (a: Acuan) => (a.kind === "lokasi" ? barisLokasi({ nama: a.baku, alamat: a.detail }) : `- ${a.baku}${a.detail ? ` (${a.detail})` : ""}`);
export type { Personil };
