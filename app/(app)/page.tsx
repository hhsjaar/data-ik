import Link from "next/link";
import SyncPanel from "@/components/SyncPanel";
import { labelKejadian } from "@/lib/format";
import { loadReports } from "@/lib/reports";
import { readDb } from "@/lib/store";
import { JENIS_LAPORAN } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function Beranda() {
  const db = await readDb();
  let hitung: Record<string, number> = {};
  let galat = "";
  try {
    for (const r of await loadReports()) hitung[r.template_type] = (hitung[r.template_type] ?? 0) + 1;
  } catch (e) {
    galat = (e as Error).message;
    hitung = {};
  }
  const kejadian = [...db.kejadian].sort((a, b) => b.tanggal.localeCompare(a.tanggal)).slice(0, 6);
  const total = Object.values(hitung).reduce((a, b) => a + b, 0);

  return (
    <>
      <h1>Data IK</h1>
      <p className="sub">Arsip laporan dan data khusus yang otomatis dihimpun dari aplikasi pembuat-laporan.</p>
      {galat && <div className="note bad">Laporan tidak bisa dimuat: {galat}</div>}

      <h2>Data khusus</h2>
      <div className="cards">
        <Link className="card" href="/lokasi"><div className="big">{db.lokasi.length}</div><div className="lbl">Lokasi / tempat penting</div></Link>
        <Link className="card" href="/orang"><div className="big">{db.orang.length}</div><div className="lbl">Orang penting</div></Link>
        <Link className="card" href="/kejadian"><div className="big">{db.kejadian.length}</div><div className="lbl">Kejadian menonjol</div></Link>
        <Link className="card" href="/catatan"><div className="big">{db.catatan.length}</div><div className="lbl">Catatan WhatsApp / web</div></Link>
      </div>

      <h2>Laporan ({total})</h2>
      <div className="cards">
        {JENIS_LAPORAN.map((j) => (
          <Link key={j.key} className="card" href={`/laporan?jenis=${j.key}`} style={{ borderTop: `3px solid ${j.warna}` }}>
            <div className="big">{hitung[j.key] ?? 0}</div>
            <div className="lbl">{j.label}</div>
          </Link>
        ))}
      </div>

      <div className="two">
        <SyncPanel />
        <div className="panel">
          <h2>Kejadian terbaru</h2>
          {kejadian.length === 0 && <p className="muted small">Belum ada kejadian tercatat.</p>}
          <ul className="ulist">
            {kejadian.map((e) => (
              <li key={e.id}>
                <span className="badge">{labelKejadian(e.jenis)}</span> <span className="small muted">{e.tanggal}</span>
                <br />
                {e.judul}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </>
  );
}
