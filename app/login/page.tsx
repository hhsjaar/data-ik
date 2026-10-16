"use client";

import { useState } from "react";

export default function Login() {
  const [kode, setKode] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function kirim(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    const r = await fetch("/api/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kode }) });
    if (r.ok) {
      const next = new URLSearchParams(location.search).get("next");
      location.href = next && next.startsWith("/") ? next : "/";
    } else {
      setErr((await r.json()).error ?? "Gagal masuk.");
      setBusy(false);
    }
  }

  return (
    <div className="login">
      <form onSubmit={kirim} className="panel">
        <div className="brand" style={{ padding: 0, marginBottom: 12 }}>
          <i>IK</i>
          <span>Data IK</span>
        </div>
        <p className="sub">Masukkan kode akses.</p>
        <div className="field">
          <input type="password" autoFocus value={kode} onChange={(e) => setKode(e.target.value)} aria-label="Kode akses" />
        </div>
        {err && <p className="err">{err}</p>}
        <button className="btn primary" disabled={busy || !kode} style={{ width: "100%" }}>
          Masuk
        </button>
      </form>
    </div>
  );
}
