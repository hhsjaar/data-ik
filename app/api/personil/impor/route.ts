import { NextResponse } from "next/server";
import { bacaPersonil } from "@/lib/excel-personil";
import { imporPersonil } from "@/lib/sync";

export const maxDuration = 60;

/** POST multipart/form-data dengan field `file` (.xls / .xlsx daftar nominatif personil). */
export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const f = form.get("file");
    if (!(f instanceof File)) return NextResponse.json({ error: "Pilih file Excel (.xls / .xlsx)." }, { status: 400 });
    if (f.size > 5_000_000) return NextResponse.json({ error: "File terlalu besar (maks 5 MB)." }, { status: 400 });
    if (!/\.xlsx?$/i.test(f.name)) return NextResponse.json({ error: "Format harus .xls atau .xlsx." }, { status: 400 });
    const baris = bacaPersonil(Buffer.from(await f.arrayBuffer()));
    if (baris.length === 0) return NextResponse.json({ error: "Tidak ada baris personil yang terbaca." }, { status: 400 });
    return NextResponse.json(await imporPersonil(baris));
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
