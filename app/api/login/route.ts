import { NextResponse } from "next/server";
import { COOKIE, tokenAkses } from "@/lib/auth";

export async function POST(req: Request) {
  const { kode } = (await req.json().catch(() => ({}))) as { kode?: string };
  if (!process.env.ACCESS_CODE || kode !== process.env.ACCESS_CODE) {
    return NextResponse.json({ error: "Kode akses salah." }, { status: 401 });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE, await tokenAkses(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(COOKIE);
  return res;
}
