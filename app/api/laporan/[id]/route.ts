import { NextResponse } from "next/server";
import { getReport } from "@/lib/reports";
import { readDb } from "@/lib/store";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const r = await getReport(id);
    if (!r) return NextResponse.json({ error: "Laporan tidak ditemukan." }, { status: 404 });
    const db = await readDb();
    const muncul = {
      lokasi: db.lokasi.filter((l) => l.sumber.includes(id)),
      orang: db.orang.filter((o) => o.sumber.includes(id)),
      kejadian: db.kejadian.filter((e) => e.sumber.includes(id)),
    };
    return NextResponse.json({ ...r, muncul });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
