"use client";

import { useEffect, useState } from "react";

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

const standalone = () =>
  window.matchMedia("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone === true;

/** Mendaftarkan service worker dan menyediakan tombol "Instal aplikasi" (Android/desktop: dialog bawaan; iPhone: petunjuk). */
export default function PwaClient({ kelas = "btn" }: { kelas?: string }) {
  const [evt, setEvt] = useState<InstallEvent | null>(null);
  const [ios, setIos] = useState(false);
  const [terpasang, setTerpasang] = useState(true); // sembunyikan sampai tahu pasti
  const [petunjuk, setPetunjuk] = useState(false);

  useEffect(() => {
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {});
    }
    setTerpasang(standalone());
    const ua = navigator.userAgent;
    setIos(/iPhone|iPad|iPod/.test(ua) || (ua.includes("Mac") && "ontouchend" in document));
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setEvt(e as InstallEvent);
    };
    const onInstalled = () => {
      setTerpasang(true);
      setEvt(null);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (terpasang || (!evt && !ios)) return null;

  return (
    <>
      <button
        className={kelas}
        onClick={async () => {
          if (evt) {
            await evt.prompt();
            await evt.userChoice.catch(() => null);
            setEvt(null);
          } else {
            setPetunjuk(true);
          }
        }}
      >
        📲 Instal aplikasi
      </button>
      {petunjuk && (
        <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && setPetunjuk(false)}>
          <div className="modal">
            <h2>Instal Data IK di iPhone / iPad</h2>
            <ol className="ulist">
              <li>Buka halaman ini di <b>Safari</b> (bukan di dalam aplikasi lain).</li>
              <li>Ketuk tombol <b>Bagikan</b> (kotak dengan panah ke atas) di bilah bawah.</li>
              <li>Gulir lalu pilih <b>Tambah ke Layar Utama</b>, kemudian <b>Tambah</b>.</li>
            </ol>
            <div className="actions"><button className="btn primary" onClick={() => setPetunjuk(false)}>Mengerti</button></div>
          </div>
        </div>
      )}
    </>
  );
}
