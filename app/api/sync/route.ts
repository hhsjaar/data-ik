import { NextResponse } from "next/server";
import { lengkapiAlamat } from "@/lib/alamat";
import { hitungAntrean, langkahSync, rapikanData } from "@/lib/sync";

export const maxDuration = 60;

export async function GET() {
  try {
    return NextResponse.json({ antrean: await hitungAntrean() });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

/**
 * Satu tahap pekerjaan. Klien memanggil berulang sampai `sisa` = 0.
 *  {}                         proses sebagian laporan baru/berubah
 *  { gen: "<token>" }         proses ulang semua (token baru = putaran baru)
 *  { lengkapiAlamat: true }   isi alamat kosong dengan AI (sebagian)
 *  { rapikan: true }          gabungkan duplikat
 */
export async function POST(req: Request) {
  try {
    const b = (await req.json().catch(() => ({}))) as { gen?: string; rapikan?: boolean; lengkapiAlamat?: boolean };
    if (b.lengkapiAlamat) return NextResponse.json(await lengkapiAlamat());
    if (b.rapikan) return NextResponse.json({ digabung: await rapikanData() });
    return NextResponse.json(await langkahSync({ gen: b.gen }));
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
