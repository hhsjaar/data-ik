import { promises as fs } from "fs";
import path from "path";
import type { DbShape } from "./types";

// Dua mode penyimpanan dengan antarmuka sama (readDb / mutate):
//  - Supabase  : bila DATAIK_SUPABASE_SERVICE_KEY terisi (untuk Vercel / produksi). Tabel dataik_* (supabase/schema.sql).
//  - Berkas    : data/dataik.json (pengembangan lokal / satu server).
const FILE = path.join(process.cwd(), "data", "dataik.json");

const kosong = (): DbShape => ({ lokasi: [], orang: [], kejadian: [], catatan: [], personil: [], diproses: {} });

export function storeMode(): "supabase" | "berkas" {
  return process.env.DATAIK_SUPABASE_SERVICE_KEY ? "supabase" : "berkas";
}

// ---------- Mode berkas ----------

// Disimpan di globalThis agar semua salinan modul (hot reload, route berbeda) memakai satu cache & satu antrean.
const g = globalThis as unknown as { __dataikStore?: { cache: DbShape | null; antre: Promise<unknown> } };
const state = (g.__dataikStore ??= { cache: null, antre: Promise.resolve() });

async function loadFile(): Promise<DbShape> {
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

async function saveFile(db: DbShape) {
  await fs.mkdir(path.dirname(FILE), { recursive: true });
  const tmp = `${FILE}.${process.pid}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(db), "utf8");
  await fs.rename(tmp, FILE);
}

// ---------- Mode Supabase ----------

const TABEL = {
  lokasi: "dataik_lokasi",
  orang: "dataik_orang",
  kejadian: "dataik_kejadian",
  catatan: "dataik_catatan",
  personil: "dataik_personil",
  diproses: "dataik_diproses",
} as const;
type Koleksi = keyof typeof TABEL;
type Baris = { id: string; data: unknown };

function cfg() {
  const url = (process.env.DATAIK_SUPABASE_URL || process.env.REPORT_SUPABASE_URL || "").replace(/\/$/, "");
  const key = process.env.DATAIK_SUPABASE_SERVICE_KEY!;
  if (!url) throw new Error("DATAIK_SUPABASE_URL / REPORT_SUPABASE_URL belum diisi.");
  return { url, headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" } };
}

async function rest(tabel: string, query: string, init: RequestInit = {}) {
  const { url, headers } = cfg();
  const res = await fetch(`${url}/rest/v1/${tabel}${query}`, { ...init, headers: { ...headers, ...(init.headers as object) }, cache: "no-store" });
  if (!res.ok) {
    const t = await res.text();
    const hint = res.status === 404 || /relation|does not exist|schema cache/i.test(t) ? " (tabel belum dibuat? jalankan supabase/schema.sql)" : "";
    throw new Error(`Supabase ${tabel} ${res.status}: ${t.slice(0, 200)}${hint}`);
  }
  return res;
}

async function ambilSemua(tabel: string, opsional = false): Promise<Baris[]> {
  const out: Baris[] = [];
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    let rows: Baris[];
    try {
      const r = await rest(tabel, "?select=id,data&order=id", { headers: { Range: `${from}-${from + PAGE - 1}` } });
      rows = await r.json();
    } catch (e) {
      // Tabel opsional yang belum dibuat dianggap kosong agar bagian lain aplikasi tetap jalan.
      if (opsional && /tabel belum dibuat|relation|schema cache|404/i.test((e as Error).message)) return [];
      throw e;
    }
    out.push(...rows);
    if (rows.length < PAGE) break;
  }
  return out;
}

async function loadRemote(): Promise<DbShape> {
  const [lokasi, orang, kejadian, catatan, personil, diproses] = await Promise.all((Object.keys(TABEL) as Koleksi[]).map((k) => ambilSemua(TABEL[k], k === "personil")));
  const db = kosong();
  db.lokasi = lokasi.map((r) => r.data) as DbShape["lokasi"];
  db.orang = orang.map((r) => r.data) as DbShape["orang"];
  db.kejadian = kejadian.map((r) => r.data) as DbShape["kejadian"];
  db.catatan = (catatan.map((r) => r.data) as DbShape["catatan"]).sort((a, b) => b.dibuat.localeCompare(a.dibuat));
  db.personil = (personil.map((r) => r.data) as DbShape["personil"]).sort((a, b) => a.no - b.no);
  db.diproses = Object.fromEntries(diproses.map((r) => [r.id, r.data])) as DbShape["diproses"];
  return db;
}

/** Peta id -> JSON untuk tiap koleksi, dipakai mendeteksi baris yang berubah. */
function potret(db: DbShape): Record<Koleksi, Map<string, string>> {
  const m = (arr: { id: string }[]) => new Map(arr.map((x) => [x.id, JSON.stringify(x)]));
  return {
    lokasi: m(db.lokasi),
    orang: m(db.orang),
    kejadian: m(db.kejadian),
    catatan: m(db.catatan),
    personil: m(db.personil),
    diproses: new Map(Object.entries(db.diproses).map(([id, v]) => [id, JSON.stringify(v)])),
  };
}

async function tulisPerubahan(sebelum: Record<Koleksi, Map<string, string>>, sesudah: Record<Koleksi, Map<string, string>>) {
  for (const k of Object.keys(TABEL) as Koleksi[]) {
    const ubah: Baris[] = [];
    for (const [id, json] of sesudah[k]) if (sebelum[k].get(id) !== json) ubah.push({ id, data: JSON.parse(json) });
    const hapus = [...sebelum[k].keys()].filter((id) => !sesudah[k].has(id));
    for (let i = 0; i < ubah.length; i += 300) {
      await rest(TABEL[k], "?on_conflict=id", {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
        body: JSON.stringify(ubah.slice(i, i + 300).map((b) => ({ ...b, updated_at: new Date().toISOString() }))),
      });
    }
    for (let i = 0; i < hapus.length; i += 50) {
      const ids = hapus.slice(i, i + 50).map((x) => `"${x.replace(/"/g, "")}"`).join(",");
      await rest(TABEL[k], `?id=in.(${ids})`, { method: "DELETE", headers: { Prefer: "return=minimal" } });
    }
  }
}

const remote = (globalThis as unknown as { __dataikRemote?: { at: number; db: DbShape | null } });
const rc = (remote.__dataikRemote ??= { at: 0, db: null });
const TTL = 2500;

// ---------- Antarmuka ----------

/** Baca data (jangan diubah langsung; gunakan mutate). */
export async function readDb(): Promise<DbShape> {
  if (storeMode() === "berkas") {
    await state.antre;
    return loadFile();
  }
  if (rc.db && Date.now() - rc.at < TTL) return rc.db;
  const db = await loadRemote();
  rc.db = db;
  rc.at = Date.now();
  return db;
}

/** Ubah data secara serial (per proses) lalu simpan. */
export function mutate<T>(fn: (db: DbShape) => T | Promise<T>): Promise<T> {
  const next = state.antre.then(async () => {
    if (storeMode() === "berkas") {
      const db = await loadFile();
      const hasil = await fn(db);
      await saveFile(db);
      return hasil;
    }
    const db = await loadRemote(); // selalu segar: instance serverless tidak berbagi memori
    const sebelum = potret(db);
    const hasil = await fn(db);
    await tulisPerubahan(sebelum, potret(db));
    rc.db = db;
    rc.at = Date.now();
    return hasil;
  });
  state.antre = next.catch(() => undefined);
  return next;
}

export const newId = () => crypto.randomUUID();
export const now = () => new Date().toISOString();
