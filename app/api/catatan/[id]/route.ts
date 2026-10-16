import { NextResponse } from "next/server";
import { cabutSumber } from "@/lib/extract";
import { mutate } from "@/lib/store";

// Hapus catatan beserta data yang hanya berasal dari catatan itu (data yang sudah diedit/dibuat manual tetap).
export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const ok = await mutate((db) => {
    const i = db.catatan.findIndex((c) => c.id === id);
    if (i < 0) return false;
    db.catatan.splice(i, 1);
    cabutSumber(db, `catatan:${id}`, true);
    return true;
  });
  return ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "Catatan tidak ditemukan." }, { status: 404 });
}
