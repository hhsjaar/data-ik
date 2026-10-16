import { promises as fs } from "fs";
import path from "path";
import type { DbShape } from "./types";

// Penyimpanan berkas JSON (data/dataik.json). Semua akses lewat antrean agar
// baca-ubah-tulis tidak saling menimpa. Ganti berkas ini bila nanti pindah ke
// database server; antarmukanya (readDb / mutate) sengaja kecil.
const FILE = path.join(process.cwd(), "data", "dataik.json");

const kosong = (): DbShape => ({ lokasi: [], orang: [], kejadian: [], catatan: [], diproses: {} });

// Disimpan di globalThis agar semua salinan modul (hot reload, route berbeda) memakai satu cache & satu antrean.
const g = globalThis as unknown as { __dataikStore?: { cache: DbShape | null; antre: Promise<unknown> } };
const state = (g.__dataikStore ??= { cache: null, antre: Promise.resolve() });

async function load(): Promise<DbShape> {
  if (state.cache) return state.cache;
  try {
    const raw = await fs.readFile(FILE, "utf8");
    state.cache = { ...kosong(), ...JSON.parse(raw) };
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
    state.cache = kosong();
  }
  return state.cache!;
}

async function save(db: DbShape) {
  await fs.mkdir(path.dirname(FILE), { recursive: true });
  const tmp = `${FILE}.${process.pid}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(db), "utf8");
  await fs.rename(tmp, FILE);
}

/** Baca data (salinan dangkal; jangan diubah langsung). */
export async function readDb(): Promise<DbShape> {
  await state.antre;
  return load();
}

/** Ubah data secara serial lalu simpan. */
export function mutate<T>(fn: (db: DbShape) => T | Promise<T>): Promise<T> {
  const next = state.antre.then(async () => {
    const db = await load();
    const hasil = await fn(db);
    await save(db);
    return hasil;
  });
  state.antre = next.catch(() => undefined);
  return next;
}

export const newId = () => crypto.randomUUID();
export const now = () => new Date().toISOString();
