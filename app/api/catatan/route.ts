import { NextResponse } from "next/server";
import { readDb } from "@/lib/store";
import { tambahCatatan } from "@/lib/sync";

export const maxDuration = 60;

export async function GET() {
  return NextResponse.json({ items: (await readDb()).catatan });
}

export async function POST(req: Request) {
  try {
    const { teks } = (await req.json()) as { teks?: string };
    return NextResponse.json(await tambahCatatan(teks ?? "", { asal: "web" }), { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
