import { NextResponse } from "next/server";
import { hapus, isKind, ubah } from "@/lib/crud";

type Ctx = { params: Promise<{ kind: string; id: string }> };

export async function PATCH(req: Request, ctx: Ctx) {
  const { kind, id } = await ctx.params;
  if (!isKind(kind)) return NextResponse.json({ error: "Jenis data tidak dikenal." }, { status: 404 });
  try {
    const hasil = await ubah(kind, id, await req.json());
    return hasil ? NextResponse.json(hasil) : NextResponse.json({ error: "Data tidak ditemukan." }, { status: 404 });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const { kind, id } = await ctx.params;
  if (!isKind(kind)) return NextResponse.json({ error: "Jenis data tidak dikenal." }, { status: 404 });
  const ok = await hapus(kind, id);
  return ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "Data tidak ditemukan." }, { status: 404 });
}
