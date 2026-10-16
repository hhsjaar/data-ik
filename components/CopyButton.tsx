"use client";

import { useState } from "react";

export default function CopyButton({ teks, label = "Salin" }: { teks: string; label?: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button
      className="btn"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(teks);
          setOk(true);
          setTimeout(() => setOk(false), 1500);
        } catch {
          alert("Browser menolak menyalin. Salin manual dari tampilan.");
        }
      }}
    >
      {ok ? "Tersalin ✓" : label}
    </button>
  );
}
