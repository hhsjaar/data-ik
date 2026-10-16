import { rapi } from "./normalize";
import { statusDariNomor, UNIT_PERSONIL, unitDariJabatan } from "./personil";
import { mutate, newId, now } from "./store";
import {
  JENIS_KEJADIAN,
  KATEGORI_LOKASI,
  KATEGORI_ORANG,
  TINGKAT_PEJABAT,
  type Kind,
} from "./types";

export const isKind = (k: string): k is Kind => k === "lokasi" || k === "orang" || k === "kejadian" || k === "personil";

type Body = Record<string, unknown>;
const s = (b: Body, k: string, max = 400) => rapi(b[k], max);
const pilih = (v: string, daftar: readonly string[], def: string) => (daftar.includes(v) ? v : def);

/** Ambil & bersihkan hanya kolom yang boleh diubah dari body. */
function kolom(kind: Kind, b: Body, penuh: boolean): Body {
  const out: Body = {};
  const ada = (k: string) => penuh || k in b;
  if (kind === "lokasi") {
    if (ada("nama")) out.nama = s(b, "nama", 200);
    if (ada("kategori")) out.kategori = pilih(s(b, "kategori"), KATEGORI_LOKASI, "Lainnya");
    if (ada("alamat")) out.alamat = s(b, "alamat");
    if (ada("kelurahan")) out.kelurahan = s(b, "kelurahan", 80);
    if (ada("keterangan")) out.keterangan = s(b, "keterangan", 800);
    if (ada("alias")) out.alias = (Array.isArray(b.alias) ? b.alias : String(b.alias ?? "").split(",")).map((x) => rapi(x, 80)).filter(Boolean);
  } else if (kind === "orang") {
    if (ada("nama")) out.nama = s(b, "nama", 160);
    if (ada("kategori")) out.kategori = pilih(s(b, "kategori"), KATEGORI_ORANG.map((k) => k.key), "tokoh-masyarakat");
    if (ada("tingkat")) out.tingkat = pilih(s(b, "tingkat"), ["", ...TINGKAT_PEJABAT.map((t) => t.key)], "");
    for (const [k, max] of [["jabatan", 200], ["instansi", 200], ["wilayah", 100], ["rt", 6], ["rw", 6], ["keterangan", 800]] as const) {
      if (ada(k)) out[k] = s(b, k, max);
    }
  } else if (kind === "personil") {
    if (ada("nama")) out.nama = s(b, "nama", 160);
    if (ada("pangkat")) out.pangkat = s(b, "pangkat", 60);
    if (ada("nrp")) {
      out.nrp = s(b, "nrp", 40).replace(/\s+/g, "");
      out.status = statusDariNomor(String(out.nrp));
    }
    if (ada("jabatan")) out.jabatan = s(b, "jabatan", 200);
    if (ada("unit") || ada("jabatan")) {
      const u = s(b, "unit", 60);
      out.unit = (UNIT_PERSONIL as readonly string[]).includes(u) ? u : unitDariJabatan(String(out.jabatan ?? b.jabatan ?? ""));
    }
    if (ada("keterangan")) out.keterangan = s(b, "keterangan", 400);
    if (ada("no") && Number(b.no) > 0) out.no = Number(b.no);
  } else {
    if (ada("jenis")) out.jenis = pilih(s(b, "jenis"), JENIS_KEJADIAN.map((j) => j.key), "lainnya");
    if (ada("judul")) out.judul = s(b, "judul", 200);
    if (ada("tanggal")) out.tanggal = /^\d{4}-\d{2}-\d{2}$/.test(s(b, "tanggal")) ? s(b, "tanggal") : now().slice(0, 10);
    for (const [k, max] of [["waktu", 40], ["lokasi", 300], ["uraian", 1500], ["akibat", 500], ["tindak_lanjut", 800]] as const) {
      if (ada(k)) out[k] = s(b, k, max);
    }
  }
  return out;
}

async function maxNo() {
  const { readDb } = await import("./store");
  return (await readDb()).personil.reduce((m, x) => Math.max(m, x.no), 0);
}

export async function buatManual(kind: Kind, body: Body) {
  const k = kolom(kind, body, true);
  if (kind === "personil" && !k.no) k.no = (await maxNo()) + 1;
  const nama = (kind === "kejadian" ? k.judul : k.nama) as string;
  if (!nama) throw new Error(kind === "kejadian" ? "Judul wajib diisi." : "Nama wajib diisi.");
  if (kind === "kejadian" && !k.uraian) throw new Error("Uraian wajib diisi.");
  const waktu = now();
  const dasar = kind === "personil" ? { id: newId(), asal: "manual", manual: true, dibuat: waktu, diubah: waktu } : { id: newId(), sumber: [] as string[], asal: "manual", manual: true, dibuat: waktu, diubah: waktu };
  const tambahan =
    kind === "personil" ? { pangkat: "", nrp: "", jabatan: "", unit: "Lainnya", status: "Polri", keterangan: "" } : kind === "lokasi" ? { alias: [], keterangan: "", kelurahan: "", alamat: "", terakhir: waktu, sebutan: 0 } : kind === "orang" ? { tingkat: "", instansi: "", wilayah: "", rt: "", rw: "", keterangan: "", terakhir: waktu, sebutan: 0 } : { waktu: "", lokasi: "", akibat: "", tindak_lanjut: "" };
  const item = { ...tambahan, ...dasar, ...k };
  await mutate((db) => {
    (db[kind] as unknown[]).unshift(item);
  });
  return item;
}

export async function ubah(kind: Kind, id: string, body: Body) {
  const k = kolom(kind, body, false);
  return mutate((db) => {
    const arr = db[kind] as Array<Record<string, unknown>>;
    const e = arr.find((x) => x.id === id);
    if (!e) return null;
    const alamatBerubah = kind === "lokasi" && "alamat" in k && k.alamat !== e.alamat;
    Object.assign(e, k, { manual: true, diubah: now() });
    if (kind === "lokasi" && (alamatBerubah || body.terverifikasi === true)) delete e.alamat_ai;
    return e;
  });
}

export async function hapus(kind: Kind, id: string) {
  return mutate((db) => {
    const arr = db[kind] as Array<{ id: string }>;
    const i = arr.findIndex((x) => x.id === id);
    if (i < 0) return false;
    arr.splice(i, 1);
    return true;
  });
}
