import { NextResponse } from "next/server";
import { tokenAgentValid } from "@/lib/auth";
import { buatManual, isKind } from "@/lib/crud";

// POST /api/agent/data/lokasi|orang|kejadian|personil  -> tambah data (CRUD dari WhatsApp)
export async function POST(req: Request, ctx: { params: Promise<{ kind: string }> }) {
  if (!tokenAgentValid(req)) return NextResponse.json({ error: "Token tidak valid." }, { status: 401 });
  const { kind } = await ctx.params;
  if (!isKind(kind)) return NextResponse.json({ error: "Jenis data tidak dikenal." }, { status: 404 });
  try {
    return NextResponse.json(await buatManual(kind, await req.json()), { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
