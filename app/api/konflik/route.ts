import { NextResponse } from "next/server";
import { deteksiKonflik, selesaikanKonflik } from "@/lib/konflik";
import { mutate, readDb } from "@/lib/store";

export async function GET() {
  return NextResponse.json({ items: deteksiKonflik(await readDb()) });
}

/** Putuskan satu konflik: { id, kode, teks? } */
export async function POST(req: Request) {
  const b = (await req.json().catch(() => ({}))) as { id?: string; kode?: string; teks?: string };
  if (!b.id || !b.kode) return NextResponse.json({ error: "id dan kode wajib." }, { status: 400 });
  const hasil = await mutate((db) => selesaikanKonflik(db, b.id!, b.kode!, b.teks));
  return NextResponse.json(hasil, { status: hasil.ok ? 200 : 400 });
}
