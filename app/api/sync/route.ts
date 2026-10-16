import { NextResponse } from "next/server";
import { lengkapiAlamat } from "@/lib/alamat";
import { getSyncStatus, hitungAntrean, mulaiSync, rapikanData } from "@/lib/sync";

export async function GET() {
  try {
    return NextResponse.json({ status: getSyncStatus(), antrean: await hitungAntrean() });
  } catch (e) {
    return NextResponse.json({ status: getSyncStatus(), error: (e as Error).message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const b = (await req.json().catch(() => ({}))) as { ulang?: boolean; batas?: number; rapikan?: boolean; lengkapiAlamat?: boolean };
    if (b.lengkapiAlamat) return NextResponse.json(await lengkapiAlamat());
    if (b.rapikan) return NextResponse.json({ digabung: await rapikanData() });
    const status = await mulaiSync({ ulang: !!b.ulang, batas: b.batas ? Number(b.batas) : undefined });
    return NextResponse.json({ status });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
