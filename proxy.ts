import { NextRequest, NextResponse } from "next/server";
import { COOKIE, aksesDiwajibkan, tokenAkses } from "@/lib/auth";

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg).*)"],
};

export async function proxy(req: NextRequest) {
  if (!aksesDiwajibkan()) return NextResponse.next();
  const { pathname } = req.nextUrl;
  // /api/agent/* memakai token Bearer (AGENT_TOKEN) yang diperiksa di route-nya sendiri.
  if (pathname === "/login" || pathname === "/api/login" || pathname.startsWith("/api/agent/")) {
    return NextResponse.next();
  }
  if (req.cookies.get(COOKIE)?.value === (await tokenAkses())) return NextResponse.next();
  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Butuh kode akses." }, { status: 401 });
  }
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  if (pathname !== "/") url.searchParams.set("next", pathname);
  return NextResponse.redirect(url);
}
