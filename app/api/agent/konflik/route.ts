import { NextResponse } from "next/server";
import { tokenAgentValid } from "@/lib/auth";
import { deteksiKonflik, selesaikanKonflik } from "@/lib/konflik";
import { mutate, readDb } from "@/lib/store";

// Untuk levelupaiagent: daftar hal yang perlu diputuskan pengguna, dan penyelesaiannya.
export async function GET(req: Request) {
  if (!tokenAgentValid(req)) return NextResponse.json({ error: "Token tidak valid." }, { status: 401 });
  const limit = Math.min(Number(new URL(req.url).searchParams.get("limit")) || 10, 50);
  const semua = deteksiKonflik(await readDb());
  return NextResponse.json({ total: semua.length, items: semua.slice(0, limit) });
}

/** { id, kode, teks? } (kode "baru" + teks = alamat yang diketik pengguna) */
export async function POST(req: Request) {
  if (!tokenAgentValid(req)) return NextResponse.json({ error: "Token tidak valid." }, { status: 401 });
  const b = (await req.json().catch(() => ({}))) as { id?: string; kode?: string; teks?: string };
  if (!b.id || !b.kode) return NextResponse.json({ error: "id dan kode wajib." }, { status: 400 });
  const hasil = await mutate((db) => selesaikanKonflik(db, b.id!, b.kode!, b.teks));
  return NextResponse.json(hasil, { status: hasil.ok ? 200 : 400 });
}
