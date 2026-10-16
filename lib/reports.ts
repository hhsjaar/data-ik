import { jenisInfo, type ReportRow, type ReportSummary } from "./types";

// Sumber: tabel `report_history` di Supabase milik aplikasi pembuat-laporan.
// Hanya dibaca, tidak pernah ditulis/diubah dari sini.
const TTL_MS = 60_000;
let cache: { at: number; rows: ReportRow[] } | null = null;

export function reportSourceConfigured() {
  return !!process.env.REPORT_SUPABASE_URL && !!process.env.REPORT_SUPABASE_KEY;
}

async function fetchPage(from: number, to: number): Promise<ReportRow[]> {
  const url = process.env.REPORT_SUPABASE_URL!;
  const key = process.env.REPORT_SUPABASE_KEY!;
  const res = await fetch(
    `${url}/rest/v1/report_history?select=*&order=created_at.desc`,
    {
      headers: { apikey: key, Authorization: `Bearer ${key}`, Range: `${from}-${to}` },
      cache: "no-store",
    },
  );
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res.json();
}

export async function loadReports(force = false): Promise<ReportRow[]> {
  if (!reportSourceConfigured()) {
    throw new Error("REPORT_SUPABASE_URL / REPORT_SUPABASE_KEY belum diisi di .env.local");
  }
  if (!force && cache && Date.now() - cache.at < TTL_MS) return cache.rows;
  const rows: ReportRow[] = [];
  const PAGE = 200;
  for (let from = 0; ; from += PAGE) {
    const page = await fetchPage(from, from + PAGE - 1);
    rows.push(...page);
    if (page.length < PAGE) break;
  }
  cache = { at: Date.now(), rows };
  return rows;
}

export async function getReport(id: string): Promise<ReportRow | null> {
  return (await loadReports()).find((r) => r.id === id) ?? null;
}

const bersih = (s: string) => s.replace(/[*_=#-]{2,}/g, " ").replace(/\s+/g, " ").trim();

export function summarize(r: ReportRow): ReportSummary {
  return {
    id: r.id,
    jenis: r.template_type,
    perihal: bersih(r.perihal || "") || "(tanpa perihal)",
    tanggal: r.created_at,
    ringkas: bersih(r.content || "").slice(0, 260),
    panjang: (r.content || "").length,
  };
}

export function jenisLabel(key: string) {
  return jenisInfo(key).label;
}

/** Hash ringan untuk mendeteksi laporan yang berubah sejak diproses. */
export function hashText(s: string) {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return `${s.length}:${(h >>> 0).toString(36)}`;
}
