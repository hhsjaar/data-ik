"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense } from "react";

type Item = { href: string; label: string; n?: number };

function NavInner({ utama, jenis }: { utama: Item[]; jenis: Item[] }) {
  const pathname = usePathname();
  const sp = useSearchParams();
  const on = (i: Item) => {
    const [path, query] = i.href.split("?");
    if (path === "/") return pathname === "/";
    if (path !== "/laporan") return pathname.startsWith(path);
    const jenis = new URLSearchParams(query ?? "").get("jenis");
    return jenis ? pathname === "/laporan" && sp.get("jenis") === jenis : pathname.startsWith("/laporan") && !sp.get("jenis");
  };
  const render = (i: Item) => (
    <Link key={i.href} href={i.href} className={`navlink${on(i) ? " on" : ""}`}>
      <span>{i.label}</span>
      {i.n != null && <span className="n">{i.n}</span>}
    </Link>
  );
  return (
    <>
      {render(utama[0])}
      <div className="navgroup">Laporan</div>
      {jenis.map(render)}
      <div className="navgroup">Data khusus</div>
      {utama.slice(1).map(render)}
    </>
  );
}

export default function Nav(props: { utama: Item[]; jenis: Item[] }) {
  return (
    <Suspense fallback={null}>
      <NavInner {...props} />
    </Suspense>
  );
}

export function KeluarButton() {
  return (
    <button
      className="btn small"
      onClick={async () => {
        await fetch("/api/login", { method: "DELETE" });
        location.href = "/login";
      }}
    >
      Keluar
    </button>
  );
}
