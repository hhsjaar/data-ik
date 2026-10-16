"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { JENIS_LAPORAN, jenisInfo, type ReportSummary } from "@/lib/types";

const tgl = (iso: string) => new Date(iso).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });

export default function LaporanBrowser() {
  const router = useRouter();
  const sp = useSearchParams();
  const jenis = sp.get("jenis") ?? "";
  const [q, setQ] = useState("");
  const [dq, setDq] = useState("");
  const [dari, setDari] = useState("");
  const [sampai, setSampai] = useState("");
  const [sort, setSort] = useState("baru");
  const [data, setData] = useState<{ items: ReportSummary[]; hitung: Record<string, number> } | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDq(q), 300);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    const ctl = new AbortController();
    const p = new URLSearchParams({ sort });
    if (jenis) p.set("jenis", jenis);
    if (dq) p.set("q", dq);
    if (dari) p.set("dari", dari);
    if (sampai) p.set("sampai", sampai);
    fetch(`/api/laporan?${p}`, { signal: ctl.signal })
      .then((r) => r.json())
      .then((j) => (j.error ? setErr(j.error) : (setErr(""), setData(j))))
      .catch((e) => e.name !== "AbortError" && setErr("Gagal memuat laporan."));
    return () => ctl.abort();
  }, [jenis, dq, dari, sampai, sort]);

  const pilih = (k: string) => router.replace(k ? `/laporan?jenis=${k}` : "/laporan");
  const semua = data ? Object.values(data.hitung).reduce((a, b) => a + b, 0) : 0;

  return (
    <>
      <h1>{jenis ? jenisInfo(jenis).label : "Semua laporan"}</h1>
      <p className="sub">Diambil langsung dari riwayat aplikasi pembuat-laporan, dikelompokkan menurut jenis laporan.</p>

      <div className="chips">
        <button className={`chip${!jenis ? " on" : ""}`} onClick={() => pilih("")}>Semua<span className="n">{semua}</span></button>
        {JENIS_LAPORAN.map((j) => (
          <button key={j.key} className={`chip${jenis === j.key ? " on" : ""}`} onClick={() => pilih(j.key)}>
            {j.label}<span className="n">{data?.hitung[j.key] ?? 0}</span>
          </button>
        ))}
      </div>

      <div className="toolbar">
        <input type="search" className="search" placeholder="Cari kata di perihal atau isi laporan…" value={q} onChange={(e) => setQ(e.target.value)} />
        <input type="date" value={dari} onChange={(e) => setDari(e.target.value)} aria-label="Dari tanggal" />
        <input type="date" value={sampai} onChange={(e) => setSampai(e.target.value)} aria-label="Sampai tanggal" />
        <select value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Urutan">
          <option value="baru">Terbaru dulu</option>
          <option value="lama">Terlama dulu</option>
          <option value="perihal">Perihal A–Z</option>
        </select>
        {(q || dari || sampai) && <button className="btn" onClick={() => { setQ(""); setDari(""); setSampai(""); }}>Reset</button>}
      </div>

      {err && <div className="note bad">{err}</div>}
      {!data && !err && <p className="muted">Memuat…</p>}
      {data && (
        <>
          <p className="muted small">{data.items.length} laporan</p>
          <div className="rlist">
            {data.items.map((r) => {
              const j = jenisInfo(r.jenis);
              return (
                <Link key={r.id} href={`/laporan/${r.id}`} className="ritem">
                  <div className="top">
                    <span className="ttl">{r.perihal}</span>
                    <span className="small muted" style={{ whiteSpace: "nowrap" }}>{tgl(r.tanggal)}</span>
                  </div>
                  <div style={{ marginBottom: 4 }}>
                    <span className="badge" style={{ background: `${j.warna}22`, color: j.warna }}>{j.label}</span>
                  </div>
                  <div className="snip">{r.ringkas}</div>
                </Link>
              );
            })}
            {data.items.length === 0 && <div className="empty">Tidak ada laporan yang cocok.</div>}
          </div>
        </>
      )}
    </>
  );
}
