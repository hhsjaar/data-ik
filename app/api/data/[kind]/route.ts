import { NextResponse } from "next/server";
import { cariData, paramDari } from "@/lib/query";
import { buatManual, isKind } from "@/lib/crud";

export async function GET(req: Request, ctx: { params: Promise<{ kind: string }> }) {
  const { kind } = await ctx.params;
  if (!isKind(kind)) return NextResponse.json({ error: "Jenis data tidak dikenal." }, { status: 404 });
  return NextResponse.json(await cariData(kind, paramDari(new URL(req.url).searchParams)));
}

export async function POST(req: Request, ctx: { params: Promise<{ kind: string }> }) {
  const { kind } = await ctx.params;
  if (!isKind(kind)) return NextResponse.json({ error: "Jenis data tidak dikenal." }, { status: 404 });
  try {
    const body = await req.json();
    return NextResponse.json(await buatManual(kind, body), { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
