import Link from "next/link";
import { notFound } from "next/navigation";
import CopyButton from "@/components/CopyButton";
import { barisKejadian, barisLokasi, barisOrang, labelKejadian } from "@/lib/format";
import { getReport } from "@/lib/reports";
import { readDb } from "@/lib/store";
import { jenisInfo } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function DetailLaporan({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const r = await getReport(id).catch(() => null);
  if (!r) notFound();
  const db = await readDb();
  const lokasi = db.lokasi.filter((l) => l.sumber.includes(id));
  const orang = db.orang.filter((o) => o.sumber.includes(id));
  const kejadian = db.kejadian.filter((e) => e.sumber.includes(id));
  const j = jenisInfo(r.template_type);
  const diproses = db.diproses[id];

  return (
    <>
      <p className="small"><Link href={`/laporan?jenis=${r.template_type}`}>← {j.label}</Link></p>
      <h1>{r.perihal}</h1>
      <p className="sub">
        <span className="badge" style={{ background: `${j.warna}22`, color: j.warna }}>{j.label}</span>{" "}
        {new Date(r.created_at).toLocaleString("id-ID", { dateStyle: "full", timeStyle: "short" })}
        {r.kapolsek_nama ? ` · ${r.kapolsek_nama}` : ""}
      </p>
      <div className="two">
        <div>
          <div className="toolbar"><CopyButton teks={r.content} label="Salin isi laporan" /></div>
          <div className="doc">{r.content}</div>
        </div>
        <div>
          <div className="panel">
            <h2>Data yang diambil dari laporan ini</h2>
            {!diproses && <p className="muted small">Laporan ini belum diolah. Jalankan sinkronisasi di Beranda.</p>}
            {diproses && lokasi.length + orang.length + kejadian.length === 0 && <p className="muted small">Tidak ada lokasi, orang, atau kejadian penting yang terdeteksi.</p>}
            {lokasi.length > 0 && (<><b className="small">Lokasi</b><ul className="ulist small">{lokasi.map((l) => <li key={l.id}>{barisLokasi(l).replace(/^- /, "")}</li>)}</ul></>)}
            {orang.length > 0 && (<><b className="small">Orang</b><ul className="ulist small">{orang.map((o) => <li key={o.id}>{barisOrang(o).replace(/^- /, "")}</li>)}</ul></>)}
            {kejadian.length > 0 && (<><b className="small">Kejadian</b><ul className="ulist small">{kejadian.map((e) => <li key={e.id}><span className="badge">{labelKejadian(e.jenis)}</span> {barisKejadian(e).replace(/^- /, "")}</li>)}</ul></>)}
          </div>
        </div>
      </div>
    </>
  );
}
