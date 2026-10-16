"use client";

import { useCallback, useEffect, useState } from "react";
import type { SyncStatus } from "@/lib/sync";

type Antrean = { totalLaporan: number; antre: number; sudah: number };

export default function SyncPanel() {
  const [status, setStatus] = useState<SyncStatus | null>(null);
  const [antrean, setAntrean] = useState<Antrean | null>(null);
  const [err, setErr] = useState("");

  const muat = useCallback(async () => {
    try {
      const r = await fetch("/api/sync", { cache: "no-store" });
      const j = await r.json();
      if (j.error) setErr(j.error);
      else setErr("");
      if (j.status) setStatus(j.status);
      if (j.antrean) setAntrean(j.antrean);
    } catch {
      setErr("Tidak bisa menghubungi server.");
    }
  }, []);

  useEffect(() => {
    muat();
  }, [muat]);
  useEffect(() => {
    if (!status?.berjalan) return;
    const t = setInterval(muat, 2500);
    return () => clearInterval(t);
  }, [status?.berjalan, muat]);

  async function mulai(ulang: boolean) {
    if (ulang && !confirm("Proses ulang SEMUA laporan? Data hasil ekstraksi akan dihitung ulang (data yang Anda ubah sendiri tetap aman).")) return;
    setErr("");
    const r = await fetch("/api/sync", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ulang }) });
    const j = await r.json();
    if (j.error) setErr(j.error);
    await muat();
  }

  const pct = status && status.total ? Math.round((status.selesaiCount / status.total) * 100) : 0;
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
      {status?.berjalan && (
        <>
          <div className="progress"><div style={{ width: `${pct}%` }} /></div>
          <p className="small muted" style={{ margin: 0 }}>
            Memproses {status.selesaiCount}/{status.total} · baru: {status.baru.lokasi} lokasi, {status.baru.orang} orang, {status.baru.kejadian} kejadian
          </p>
        </>
      )}
      {!status?.berjalan && status?.selesai && (
        <p className="small ok" style={{ margin: "0 0 8px" }}>
          Terakhir selesai: {status.selesaiCount}/{status.total} laporan · baru {status.baru.lokasi} lokasi, {status.baru.orang} orang, {status.baru.kejadian} kejadian
          {status.galat.length > 0 && <span className="err"> · {status.galat.length} gagal (coba jalankan lagi)</span>}
        </p>
      )}
      {(err || status?.galatUmum) && <p className="err small">{err || status?.galatUmum}</p>}
      <div className="toolbar" style={{ margin: "10px 0 0" }}>
        <button className="btn primary" disabled={!!status?.berjalan || antrean?.antre === 0} onClick={() => mulai(false)}>
          {antrean?.antre ? `Proses ${antrean.antre} laporan baru` : "Tidak ada laporan baru"}
        </button>
        <button className="btn" disabled={!!status?.berjalan} onClick={() => mulai(true)}>
          Proses ulang semua
        </button>
      </div>
    </div>
  );
}
