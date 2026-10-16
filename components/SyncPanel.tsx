"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Antrean = { totalLaporan: number; antre: number; sudah: number };
type Progres = { selesai: number; total: number; baru: { lokasi: number; orang: number; kejadian: number }; galat: number };

export default function SyncPanel() {
  const [antrean, setAntrean] = useState<Antrean | null>(null);
  const [progres, setProgres] = useState<Progres | null>(null);
  const [jalan, setJalan] = useState(false);
  const [selesai, setSelesai] = useState(false);
  const [err, setErr] = useState("");
  const henti = useRef(false);

  const muat = useCallback(async () => {
    try {
      const j = await (await fetch("/api/sync", { cache: "no-store" })).json();
      if (j.error) setErr(j.error);
      else (setErr(""), setAntrean(j.antrean));
    } catch {
      setErr("Tidak bisa menghubungi server.");
    }
  }, []);
  useEffect(() => {
    muat();
  }, [muat]);

  async function mulai(ulang: boolean) {
    if (ulang && !confirm("Proses ulang SEMUA laporan? Data hasil ekstraksi akan dihitung ulang (data yang Anda ubah sendiri tetap aman).")) return;
    setErr("");
    setSelesai(false);
    setJalan(true);
    henti.current = false;
    const gen = ulang ? String(Date.now()) : undefined;
    const awal = antrean?.antre ?? 0;
    const total = ulang ? (antrean?.totalLaporan ?? 0) : awal;
    const p: Progres = { selesai: 0, total, baru: { lokasi: 0, orang: 0, kejadian: 0 }, galat: 0 };
    setProgres({ ...p });
    try {
      for (let putaran = 0; putaran < 200 && !henti.current; putaran++) {
        const r = await fetch("/api/sync", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ gen }) });
        const j = await r.json();
        if (!r.ok) throw new Error(j.error ?? "Gagal.");
        p.selesai += j.diproses;
        p.baru.lokasi += j.baru.lokasi;
        p.baru.orang += j.baru.orang;
        p.baru.kejadian += j.baru.kejadian;
        p.galat = j.galat.length;
        p.total = Math.max(p.total, p.selesai + j.sisa);
        setProgres({ ...p, baru: { ...p.baru } });
        if (j.sisa === 0 || j.diproses === 0) break;
      }
      setSelesai(true);
    } catch (e) {
      setErr((e as Error).message);
    }
    setJalan(false);
    muat();
  }

  const pct = progres && progres.total ? Math.min(100, Math.round((progres.selesai / progres.total) * 100)) : 0;
  return (
    <div className="panel">
      <h2>Sinkronisasi dari Pembuat Laporan</h2>
      <p className="muted small" style={{ marginTop: 0 }}>
        Laporan baru di aplikasi pembuat-laporan dibaca otomatis dan diolah AI menjadi lokasi penting, orang penting, dan kejadian menonjol.
        {antrean && (
          <>
            {" "}
            <b>{antrean.sudah}</b> dari <b>{antrean.totalLaporan}</b> laporan sudah diolah
            {antrean.antre > 0 ? <>, <b>{antrean.antre}</b> menunggu.</> : "."}
          </>
        )}
      </p>
      {progres && (
        <>
          <div className="progress"><div style={{ width: `${pct}%` }} /></div>
          <p className={`small ${selesai && !jalan ? "ok" : "muted"}`} style={{ margin: "0 0 8px" }}>
            {jalan ? "Memproses" : "Selesai"} {progres.selesai}/{progres.total} · baru: {progres.baru.lokasi} lokasi, {progres.baru.orang} orang, {progres.baru.kejadian} kejadian
            {progres.galat > 0 && <span className="err"> · {progres.galat} gagal (jalankan lagi)</span>}
          </p>
        </>
      )}
      {err && <p className="err small">{err}</p>}
      <p className="muted small" style={{ margin: "0 0 8px" }}>{jalan ? "Biarkan halaman ini tetap terbuka sampai selesai." : ""}</p>
      <div className="toolbar" style={{ margin: "10px 0 0" }}>
        <button className="btn primary" disabled={jalan || antrean?.antre === 0} onClick={() => mulai(false)}>
          {jalan ? "Memproses…" : antrean?.antre ? `Proses ${antrean.antre} laporan baru` : "Tidak ada laporan baru"}
        </button>
        {jalan ? (
          <button className="btn" onClick={() => (henti.current = true)}>Hentikan</button>
        ) : (
          <button className="btn" onClick={() => mulai(true)}>Proses ulang semua</button>
        )}
      </div>
    </div>
  );
}
