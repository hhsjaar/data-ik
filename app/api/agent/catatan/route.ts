import { NextResponse } from "next/server";
import { tokenAgentValid } from "@/lib/auth";
import { deteksiKonflik } from "@/lib/konflik";
import { readDb } from "@/lib/store";
import { tambahCatatan } from "@/lib/sync";

export const maxDuration = 60;

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
    // Konflik yang muncul karena catatan ini (alamat berbeda / nama mirip): agen menanyakannya langsung ke pengguna.
    const db = await readDb();
    const sumber = `catatan:${c.id}`;
    const konflik = deteksiKonflik(db).filter((k) => {
      if (k.jenis === "alamat") return db.lokasi.find((l) => `alamat:${l.id}` === k.id)?.alternatif?.some((a) => a.sumber.includes(sumber));
      if (k.jenis === "nama-mirip") return k.id.split(":").slice(1).some((id) => db.orang.find((o) => o.id === id)?.sumber.includes(sumber));
      return false;
    });
    const tambahan = konflik.length ? ` Ada ${konflik.length} hal yang perlu dipilih pengguna (lihat "konflik").` : "";
    return NextResponse.json({ ok: !c.galat, id: c.id, hasil: c.hasil, ringkas: ringkas + tambahan, konflik }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}

export async function GET(req: Request) {
  if (!tokenAgentValid(req)) return NextResponse.json({ error: "Token tidak valid." }, { status: 401 });
  const limit = Math.min(Number(new URL(req.url).searchParams.get("limit")) || 20, 100);
  return NextResponse.json({ items: (await readDb()).catatan.slice(0, limit) });
}
