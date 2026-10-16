import { NextResponse } from "next/server";
import { tokenAgentValid } from "@/lib/auth";
import { readDb } from "@/lib/store";
import { tambahCatatan } from "@/lib/sync";

// Untuk levelupaiagent / WhatsApp. Header: Authorization: Bearer <AGENT_TOKEN>
export async function POST(req: Request) {
  if (!tokenAgentValid(req)) return NextResponse.json({ error: "Token tidak valid." }, { status: 401 });
  try {
    const { teks, pengirim } = (await req.json()) as { teks?: string; pengirim?: string };
    const c = await tambahCatatan(teks ?? "", { asal: "whatsapp", pengirim });
    const h = c.hasil;
    const ringkas = c.galat
      ? `Catatan tersimpan, tetapi ekstraksi gagal: ${c.galat}`
      : h && h.lokasi + h.orang + h.kejadian > 0
        ? `Catatan tersimpan. Data baru: ${h.lokasi} lokasi, ${h.orang} orang, ${h.kejadian} kejadian.`
        : "Catatan tersimpan. Tidak ada data baru (mungkin sudah tercatat).";
    return NextResponse.json({ ok: !c.galat, id: c.id, hasil: c.hasil, ringkas }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}

export async function GET(req: Request) {
  if (!tokenAgentValid(req)) return NextResponse.json({ error: "Token tidak valid." }, { status: 401 });
  const limit = Math.min(Number(new URL(req.url).searchParams.get("limit")) || 20, 100);
  return NextResponse.json({ items: (await readDb()).catatan.slice(0, limit) });
}
