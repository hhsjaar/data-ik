import { NextResponse } from "next/server";
import { loadReports, summarize } from "@/lib/reports";
import { JENIS_LAPORAN } from "@/lib/types";

export async function GET(req: Request) {
  try {
    const sp = new URL(req.url).searchParams;
    const jenis = sp.get("jenis") || "";
    const q = (sp.get("q") || "").toLowerCase().split(/\s+/).filter(Boolean);
    const dari = sp.get("dari") || "";
    const sampai = sp.get("sampai") || "";
    const sort = sp.get("sort") || "baru";
    const force = sp.get("segarkan") === "1";

    const rows = await loadReports(force);
    const dasar = rows.filter((r) => {
      const tgl = r.created_at.slice(0, 10);
      if (dari && tgl < dari) return false;
      if (sampai && tgl > sampai) return false;
      if (!q.length) return true;
      const t = `${r.perihal} ${r.content}`.toLowerCase();
      return q.every((w) => t.includes(w));
    });
    const hitung: Record<string, number> = Object.fromEntries(JENIS_LAPORAN.map((j) => [j.key, 0]));
    for (const r of dasar) hitung[r.template_type] = (hitung[r.template_type] ?? 0) + 1;

    const items = dasar
      .filter((r) => !jenis || r.template_type === jenis)
      .sort(
        sort === "lama"
          ? (a, b) => a.created_at.localeCompare(b.created_at)
          : sort === "perihal"
            ? (a, b) => a.perihal.localeCompare(b.perihal, "id")
            : (a, b) => b.created_at.localeCompare(a.created_at),
      )
      .map(summarize);
    return NextResponse.json({ total: rows.length, hitung, items });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
