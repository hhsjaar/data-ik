import { NextResponse } from "next/server";
import { tokenAgentValid } from "@/lib/auth";
import { saran } from "@/lib/saran";

// GET /api/agent/saran?kind=lokasi|orang|personil&q=...&limit=8  -> rekomendasi isian kolom (autocomplete)
export async function GET(req: Request) {
  if (!tokenAgentValid(req)) return NextResponse.json({ error: "Token tidak valid." }, { status: 401 });
  const sp = new URL(req.url).searchParams;
  const kind = sp.get("kind");
  if (kind !== "lokasi" && kind !== "orang" && kind !== "personil") return NextResponse.json({ error: "kind harus lokasi, orang, atau personil." }, { status: 400 });
  return NextResponse.json({ items: await saran(kind, sp.get("q") ?? "", Number(sp.get("limit")) || 8) });
}
