import { NextResponse } from "next/server";
import { tokenAgentValid } from "@/lib/auth";
import { barisKejadian, barisLokasi, barisOrang, barisPersonil } from "@/lib/format";
import { cariData, paramDari } from "@/lib/query";
import type { Kejadian, Lokasi, Orang, Personil } from "@/lib/types";

// GET /api/agent/cari?kind=lokasi|orang|kejadian|personil&q=...&kategori=...&limit=20
export async function GET(req: Request) {
  if (!tokenAgentValid(req)) return NextResponse.json({ error: "Token tidak valid." }, { status: 401 });
  const sp = new URL(req.url).searchParams;
  const kind = sp.get("kind");
  if (kind !== "lokasi" && kind !== "orang" && kind !== "kejadian" && kind !== "personil") {
    return NextResponse.json({ error: "kind harus lokasi, orang, kejadian, atau personil." }, { status: 400 });
  }
  const p = paramDari(sp);
  p.limit = Math.min(p.limit ?? 20, 100);
  const { total, items } = await cariData(kind, p);
  const teks = items
    .map((x) => (kind === "lokasi" ? barisLokasi(x as Lokasi) : kind === "orang" ? barisOrang(x as Orang) : kind === "personil" ? barisPersonil(x as Personil) : barisKejadian(x as Kejadian)))
    .join("\n");
  return NextResponse.json({ total, teks, items });
}
