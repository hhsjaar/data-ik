import { NextResponse } from "next/server";
import { tokenAgentValid } from "@/lib/auth";
import { acuan, barisAcuan } from "@/lib/saran";

/**
 * POST { teks, hanyaTerverifikasi? } -> nama tempat/orang yang disebut di teks beserta penulisan baku,
 * alamat, dan jabatannya. Dipakai pembuat-laporan / laporan-awal sebagai acuan agar ejaan & alamat seragam.
 */
export async function POST(req: Request) {
  if (!tokenAgentValid(req)) return NextResponse.json({ error: "Token tidak valid." }, { status: 401 });
  const b = (await req.json().catch(() => ({}))) as { teks?: string; hanyaTerverifikasi?: boolean };
  if (!b.teks || b.teks.length < 3) return NextResponse.json({ error: "teks wajib." }, { status: 400 });
  const items = await acuan(b.teks.slice(0, 60_000), { hanyaTerverifikasi: !!b.hanyaTerverifikasi });
  return NextResponse.json({ items, teks: items.map(barisAcuan).join("\n") });
}
