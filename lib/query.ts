import { readDb } from "./store";
import type { Kejadian, Kind, Lokasi, Orang } from "./types";

export type Param = {
  q?: string;
  kategori?: string;
  tingkat?: string;
  jenis?: string;
  asal?: string;
  dari?: string;
  sampai?: string;
  sort?: string;
  limit?: number;
};

const teksLokasi = (l: Lokasi) => [l.nama, ...l.alias, l.kategori, l.alamat, l.kelurahan, l.keterangan].join(" ");
const teksOrang = (o: Orang) => [o.nama, o.jabatan, o.instansi, o.wilayah, o.keterangan, o.rt && `rt ${o.rt}`, o.rw && `rw ${o.rw}`].join(" ");
const teksKejadian = (e: Kejadian) => [e.judul, e.jenis.replace("-", " "), e.lokasi, e.uraian, e.akibat, e.tindak_lanjut].join(" ");

function cocokQ(teks: string, q?: string) {
  if (!q) return true;
  const t = teks.toLowerCase();
  return q
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((w) => t.includes(w));
}

const dalamTanggal = (tgl: string, dari?: string, sampai?: string) =>
  (!dari || tgl.slice(0, 10) >= dari) && (!sampai || tgl.slice(0, 10) <= sampai);

export async function cariData(kind: Kind, p: Param) {
  const db = await readDb();
  let hasil: Array<Lokasi | Orang | Kejadian>;
  if (kind === "lokasi") {
    hasil = db.lokasi
      .filter((l) => cocokQ(teksLokasi(l), p.q) && (!p.kategori || l.kategori === p.kategori) && (!p.asal || l.asal === p.asal) && dalamTanggal(l.terakhir, p.dari, p.sampai))
      .sort(
        p.sort === "nama"
          ? (a, b) => a.nama.localeCompare(b.nama, "id")
          : p.sort === "sering"
            ? (a, b) => b.sebutan - a.sebutan
            : (a, b) => b.terakhir.localeCompare(a.terakhir),
      );
  } else if (kind === "orang") {
    hasil = db.orang
      .filter(
        (o) =>
          cocokQ(teksOrang(o), p.q) && (!p.kategori || o.kategori === p.kategori) && (!p.tingkat || o.tingkat === p.tingkat) && (!p.asal || o.asal === p.asal) && dalamTanggal(o.terakhir, p.dari, p.sampai),
      )
      .sort(
        p.sort === "nama"
          ? (a, b) => a.nama.localeCompare(b.nama, "id")
          : p.sort === "sering"
            ? (a, b) => b.sebutan - a.sebutan
            : (a, b) => b.terakhir.localeCompare(a.terakhir),
      );
  } else {
    hasil = db.kejadian
      .filter((e) => cocokQ(teksKejadian(e), p.q) && (!p.jenis || e.jenis === p.jenis) && (!p.asal || e.asal === p.asal) && dalamTanggal(e.tanggal, p.dari, p.sampai))
      .sort(p.sort === "lama" ? (a, b) => a.tanggal.localeCompare(b.tanggal) : (a, b) => b.tanggal.localeCompare(a.tanggal));
  }
  const total = hasil.length;
  return { total, items: p.limit ? hasil.slice(0, p.limit) : hasil };
}

export function paramDari(sp: URLSearchParams): Param {
  const g = (k: string) => sp.get(k) || undefined;
  return {
    q: g("q"),
    kategori: g("kategori"),
    tingkat: g("tingkat"),
    jenis: g("jenis"),
    asal: g("asal"),
    dari: g("dari"),
    sampai: g("sampai"),
    sort: g("sort"),
    limit: sp.get("limit") ? Number(sp.get("limit")) : undefined,
  };
}
