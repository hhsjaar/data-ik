"use client";

import { useCallback, useEffect, useState } from "react";
import type { Catatan } from "@/lib/types";

export default function CatatanPage() {
  const [items, setItems] = useState<Catatan[] | null>(null);
  const [teks, setTeks] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);

  const muat = useCallback(async () => {
    const j = await (await fetch("/api/catatan", { cache: "no-store" })).json();
    setItems(j.items);
  }, []);
  useEffect(() => {
    muat();
  }, [muat]);

  async function kirim(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const r = await fetch("/api/catatan", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ teks }) });
    const j = await r.json();
    if (!r.ok) setMsg({ ok: false, t: j.error ?? "Gagal." });
    else if (j.galat) setMsg({ ok: false, t: `Catatan tersimpan tetapi ekstraksi gagal: ${j.galat}` });
    else {
      const h = j.hasil;
      setMsg({ ok: true, t: h && h.lokasi + h.orang + h.kejadian > 0 ? `Tersimpan. Data baru: ${h.lokasi} lokasi, ${h.orang} orang, ${h.kejadian} kejadian.` : "Tersimpan. Tidak ada data baru (mungkin sudah tercatat)." });
      setTeks("");
    }
    setBusy(false);
    muat();
  }

  return (
    <>
      <h1>Catatan WhatsApp</h1>
      <p className="sub">
        Folder khusus untuk catatan tambahan. Catatan yang dikirim lewat WhatsApp (levelupaiagent) masuk ke sini, lalu otomatis dipilah menjadi lokasi, orang, atau kejadian. Anda juga bisa mengetik langsung di bawah.
      </p>

      <form className="panel" onSubmit={kirim}>
        <h2>Tambah catatan</h2>
        <textarea rows={4} value={teks} onChange={(e) => setTeks(e.target.value)} placeholder="Contoh: Ketua RW 05 Kelurahan Sendangmulyo bernama Bapak Slamet. SD Negeri Tandang 01 beralamat di Jl. Tandang Raya No. 5, Kel. Tandang." />
        {msg && <p className={msg.ok ? "ok" : "err"}>{msg.t}</p>}
        <div className="actions"><button className="btn primary" disabled={busy || teks.trim().length < 3}>{busy ? "Memproses…" : "Simpan & olah"}</button></div>
      </form>

      <h2>Riwayat catatan {items ? `(${items.length})` : ""}</h2>
      {!items && <p className="muted">Memuat…</p>}
      {items?.length === 0 && <div className="empty panel">Belum ada catatan.</div>}
      <div className="rlist">
        {items?.map((c) => (
          <div key={c.id} className="ritem" style={{ cursor: "default" }}>
            <div className="top">
              <span className="badge">{c.asal === "whatsapp" ? "WhatsApp" : "Web"}{c.pengirim ? ` · ${c.pengirim}` : ""}</span>
              <span className="small muted">
                {new Date(c.dibuat).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })}{" "}
                <button
                  className="btn danger small"
                  onClick={async () => {
                    if (!confirm("Hapus catatan ini beserta data yang hanya berasal darinya?")) return;
                    await fetch(`/api/catatan/${c.id}`, { method: "DELETE" });
                    muat();
                  }}
                >
                  Hapus
                </button>
              </span>
            </div>
            <div style={{ whiteSpace: "pre-wrap" }}>{c.teks}</div>
            <div className="small" style={{ marginTop: 6 }}>
              {c.galat ? <span className="err">Ekstraksi gagal: {c.galat}</span> : c.hasil ? <span className="muted">Data baru: {c.hasil.lokasi} lokasi · {c.hasil.orang} orang · {c.hasil.kejadian} kejadian</span> : null}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
