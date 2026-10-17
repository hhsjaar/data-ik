"use client";

import { useCallback, useEffect, useState } from "react";
import type { Konflik } from "@/lib/konflik";

const JUDUL: Record<Konflik["jenis"], string> = {
  alamat: "Alamat berbeda",
  "nama-mirip": "Nama mirip",
  "jabatan-ganda": "Jabatan ganda",
};

export default function KoreksiPage() {
  const [items, setItems] = useState<Konflik[] | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState("");
  const [pesan, setPesan] = useState("");
  const [teksBaru, setTeksBaru] = useState<Record<string, string>>({});

  const muat = useCallback(async () => {
    try {
      const j = await (await fetch("/api/konflik", { cache: "no-store" })).json();
      setItems(j.items);
    } catch {
      setErr("Gagal memuat.");
    }
  }, []);
  useEffect(() => {
    muat();
  }, [muat]);

  async function pilih(k: Konflik, kode: string) {
    if (kode === "baru" && (teksBaru[k.id] ?? "").trim().length < 8) return setErr("Ketik alamat yang benar dulu (minimal 8 huruf).");
    setBusy(k.id + kode);
    setErr("");
    const r = await fetch("/api/konflik", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: k.id, kode, teks: teksBaru[k.id] }) });
    const j = await r.json();
    if (!r.ok) setErr(j.pesan ?? j.error ?? "Gagal.");
    else {
      setPesan(j.pesan);
      setTimeout(() => setPesan(""), 4000);
    }
    setBusy("");
    muat();
    // segarkan angka di menu samping
    window.dispatchEvent(new Event("focus"));
  }

  return (
    <>
      <h1>Perlu Dipilih</h1>
      <p className="sub">
        Bila satu tempat punya dua alamat, atau satu orang tertulis dengan ejaan/jabatan berbeda, pilih yang benar di sini. Pilihan Anda menjadi
        acuan (bertanda terverifikasi) dan tidak ditanyakan lagi. Pertanyaan yang sama juga bisa dijawab lewat WhatsApp.
      </p>
      {err && <div className="note bad">{err}</div>}
      {pesan && <div className="note">{pesan}</div>}
      {!items && !err && <p className="muted">Memuat…</p>}
      {items?.length === 0 && <div className="empty panel">Tidak ada yang perlu dipilih. 🎉</div>}
      <div className="rlist">
        {items?.map((k) => (
          <div key={k.id} className="ritem" style={{ cursor: "default" }}>
            <div className="top">
              <span className="ttl">{k.pertanyaan}</span>
              <span className="badge warn">{JUDUL[k.jenis]}</span>
            </div>
            <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
              {k.pilihan.map((p) => (
                <button key={p.kode} className="btn" style={{ textAlign: "left", whiteSpace: "normal" }} disabled={!!busy} onClick={() => pilih(k, p.kode)}>
                  {p.label}
                </button>
              ))}
              {k.jenis === "alamat" && (
                <div className="field" style={{ margin: 0 }}>
                  <textarea rows={2} placeholder="Atau ketik alamat yang benar…" value={teksBaru[k.id] ?? ""} onChange={(e) => setTeksBaru((t) => ({ ...t, [k.id]: e.target.value }))} />
                  <div><button className="btn primary" disabled={!!busy} onClick={() => pilih(k, "baru")}>Pakai alamat ini</button></div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
