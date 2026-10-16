"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { barisKejadian, barisLokasi, barisOrang, barisPersonil, labelKejadian, labelOrang, labelTingkat } from "@/lib/format";
import { UNIT_PERSONIL, rankPangkat } from "@/lib/personil";
import {
  JENIS_KEJADIAN,
  KATEGORI_LOKASI,
  KATEGORI_ORANG,
  TINGKAT_PEJABAT,
  type Kejadian,
  type Kind,
  type Lokasi,
  type Orang,
  type Personil,
} from "@/lib/types";

type Item = Lokasi | Orang | Kejadian | Personil;
type Opsi = { key: string; label: string };

const tgl = (iso: string) => (iso ? new Date(iso.length === 10 ? `${iso}T00:00:00` : iso).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" }) : "");

const META: Record<Kind, { judul: string; sub: string; tambah: string; cari: string; kategori: Opsi[]; urut: Opsi[]; tanggalField: "terakhir" | "tanggal" }> = {
  lokasi: {
    judul: "Lokasi / Tempat Penting",
    sub: "Alamat tempat penting yang pernah disebut di laporan. Format salin siap pakai: “Alamat … berlokasi di …”.",
    tambah: "Tambah lokasi",
    cari: "Cari nama, alamat, kelurahan…",
    kategori: KATEGORI_LOKASI.map((k) => ({ key: k, label: k })),
    urut: [{ key: "baru", label: "Terakhir disebut" }, { key: "nama", label: "Nama A–Z" }, { key: "sering", label: "Paling sering disebut" }],
    tanggalField: "terakhir",
  },
  orang: {
    judul: "Orang Penting",
    sub: "Pejabat, tokoh agama, tokoh masyarakat, RT/RW, dan ketua LSM yang disebut di laporan. Jabatan mengikuti laporan terbaru.",
    tambah: "Tambah orang",
    cari: "Cari nama, jabatan, instansi, wilayah…",
    kategori: KATEGORI_ORANG.map((k) => ({ key: k.key, label: k.label })),
    urut: [{ key: "baru", label: "Terakhir disebut" }, { key: "nama", label: "Nama A–Z" }, { key: "sering", label: "Paling sering disebut" }],
    tanggalField: "terakhir",
  },
  personil: {
    judul: "Data Personil Tembalang",
    sub: "Daftar nominatif personel Polsek Tembalang (diimpor dari Excel). Data sensitif: jangan dibagikan di luar kebutuhan dinas.",
    tambah: "Tambah personil",
    cari: "Cari nama, NRP/NIP, pangkat, jabatan…",
    kategori: UNIT_PERSONIL.map((k) => ({ key: k, label: k })),
    urut: [{ key: "no", label: "Nomor urut daftar" }, { key: "nama", label: "Nama A–Z" }, { key: "pangkat", label: "Pangkat tertinggi" }],
    tanggalField: "tanggal",
  },
  kejadian: {
    judul: "Kejadian Menonjol",
    sub: "Kecelakaan, kebakaran, tanah longsor, penemuan mayat, kriminalitas, dan lainnya dari Laporan Kegiatan.",
    tambah: "Tambah kejadian",
    cari: "Cari judul, lokasi, uraian…",
    kategori: JENIS_KEJADIAN.map((k) => ({ key: k.key, label: k.label })),
    urut: [{ key: "baru", label: "Terbaru dulu" }, { key: "lama", label: "Terlama dulu" }],
    tanggalField: "tanggal",
  },
};

const kategoriDari = (kind: Kind, it: Item) => (kind === "kejadian" ? (it as Kejadian).jenis : kind === "personil" ? (it as Personil).unit : (it as Lokasi | Orang).kategori);

function teksCari(it: Item) {
  const { sumber: _s, id: _i, ...r } = it as Item & { sumber: string[] };
  void _s;
  void _i;
  return Object.values(r)
    .filter((v) => typeof v === "string" || Array.isArray(v))
    .join(" ")
    .toLowerCase();
}

function baris(kind: Kind, it: Item) {
  return kind === "lokasi" ? barisLokasi(it as Lokasi) : kind === "orang" ? barisOrang(it as Orang) : kind === "personil" ? barisPersonil(it as Personil) : barisKejadian(it as Kejadian);
}

function csv(kind: Kind, items: Item[]) {
  const kol: string[] =
    kind === "lokasi"
      ? ["nama", "kategori", "alamat", "kelurahan", "alias", "terakhir", "sebutan"]
      : kind === "orang"
        ? ["nama", "kategori", "tingkat", "jabatan", "instansi", "wilayah", "rt", "rw", "terakhir", "sebutan"]
        : kind === "personil"
          ? ["no", "nama", "pangkat", "nrp", "status", "jabatan", "unit", "keterangan"]
          : ["tanggal", "waktu", "jenis", "judul", "lokasi", "uraian", "akibat", "tindak_lanjut"];
  const esc = (v: unknown) => `"${String(Array.isArray(v) ? v.join("; ") : (v ?? "")).replace(/"/g, '""')}"`;
  return "﻿" + [kol.join(","), ...items.map((it) => kol.map((k) => esc((it as unknown as Record<string, unknown>)[k])).join(","))].join("\r\n");
}

export default function DataPage({ kind }: { kind: Kind }) {
  const meta = META[kind];
  const [all, setAll] = useState<Item[] | null>(null);
  const [err, setErr] = useState("");
  const [q, setQ] = useState("");
  const [kat, setKat] = useState("");
  const [tingkat, setTingkat] = useState("");
  const [asal, setAsal] = useState("");
  const [sort, setSort] = useState(kind === "personil" ? "no" : "baru");
  const [dari, setDari] = useState("");
  const [sampai, setSampai] = useState("");
  const [edit, setEdit] = useState<Partial<Item> | null>(null);
  const [toast, setToast] = useState("");
  const [lengkapi, setLengkapi] = useState(false);
  const [statusAlamat, setStatusAlamat] = useState("");
  const [pangkat, setPangkat] = useState("");
  const [mengimpor, setMengimpor] = useState(false);

  const muat = useCallback(async () => {
    try {
      const r = await fetch(`/api/data/${kind}`, { cache: "no-store" });
      const j = await r.json();
      if (j.error) throw new Error(j.error);
      setAll(j.items);
    } catch (e) {
      setErr((e as Error).message);
    }
  }, [kind]);
  useEffect(() => {
    muat();
  }, [muat]);

  const info = (m: string) => {
    setToast(m);
    setTimeout(() => setToast(""), 1800);
  };

  const hitungKat = useMemo(() => {
    const h: Record<string, number> = {};
    for (const it of all ?? []) h[kategoriDari(kind, it)] = (h[kategoriDari(kind, it)] ?? 0) + 1;
    return h;
  }, [all, kind]);

  const tampil = useMemo(() => {
    const kata = q.toLowerCase().split(/\s+/).filter(Boolean);
    const f = (all ?? []).filter((it) => {
      if (kat && kategoriDari(kind, it) !== kat) return false;
      if (kind === "orang" && tingkat && (it as Orang).tingkat !== tingkat) return false;
      if (asal && it.asal !== asal) return false;
      if (kind === "lokasi" && statusAlamat) {
        const l = it as Lokasi;
        if (statusAlamat === "ada" && !l.alamat) return false;
        if (statusAlamat === "kosong" && l.alamat) return false;
        if (statusAlamat === "ai" && !l.alamat_ai) return false;
      }
      if (kind !== "personil") {
        const t = ((it as unknown as Record<string, string>)[meta.tanggalField] ?? "").slice(0, 10);
        if (dari && t < dari) return false;
        if (sampai && t > sampai) return false;
      }
      if (kind === "personil" && pangkat && !(it as Personil).pangkat.toUpperCase().startsWith(pangkat)) return false;
      if (kata.length) {
        const h = teksCari(it);
        return kata.every((w) => h.includes(w));
      }
      return true;
    });
    const nama = (it: Item) => ("nama" in it ? it.nama : (it as Kejadian).judul);
    const tg = (it: Item) => (it as unknown as Record<string, string>)[meta.tanggalField] ?? "";
    f.sort(
      kind === "personil" && sort === "no"
        ? (a, b) => (a as Personil).no - (b as Personil).no
        : kind === "personil" && sort === "pangkat"
          ? (a, b) => rankPangkat((a as Personil).pangkat) - rankPangkat((b as Personil).pangkat) || nama(a).localeCompare(nama(b), "id")
          : sort === "nama"
        ? (a, b) => nama(a).localeCompare(nama(b), "id")
        : sort === "sering"
          ? (a, b) => ((b as Lokasi).sebutan ?? 0) - ((a as Lokasi).sebutan ?? 0)
          : sort === "lama"
            ? (a, b) => tg(a).localeCompare(tg(b))
            : (a, b) => tg(b).localeCompare(tg(a)),
    );
    return f;
  }, [all, q, kat, tingkat, asal, statusAlamat, pangkat, sort, dari, sampai, kind, meta.tanggalField]);

  async function simpan(it: Partial<Item>) {
    const baru = !it.id;
    const r = await fetch(baru ? `/api/data/${kind}` : `/api/data/${kind}/${it.id}`, {
      method: baru ? "POST" : "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(it),
    });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error ?? "Gagal menyimpan.");
    setEdit(null);
    info("Tersimpan");
    muat();
  }
  async function hapus(it: Partial<Item>) {
    if (!confirm("Hapus data ini?")) return;
    await fetch(`/api/data/${kind}/${it.id}`, { method: "DELETE" });
    setEdit(null);
    info("Dihapus");
    muat();
  }

  const unduh = () => {
    const url = URL.createObjectURL(new Blob([csv(kind, tampil)], { type: "text/csv;charset=utf-8" }));
    const a = Object.assign(document.createElement("a"), { href: url, download: `${kind}-${new Date().toISOString().slice(0, 10)}.csv` });
    a.click();
    URL.revokeObjectURL(url);
  };
  const salin = async () => {
    try {
      await navigator.clipboard.writeText(tampil.map((it) => baris(kind, it)).join("\n"));
      info(`${tampil.length} baris tersalin`);
    } catch {
      alert("Browser menolak menyalin.");
    }
  };

  const pangkatAda = useMemo(
    () => (kind === "personil" ? [...new Set((all as Personil[] | null)?.map((x) => x.pangkat.split(" ")[0].toUpperCase()).filter(Boolean))].sort((a, b) => rankPangkat(a) - rankPangkat(b)) : []),
    [all, kind],
  );
  async function impor(file: File) {
    if (!confirm(`Impor "${file.name}"? Personil yang sudah ada diperbarui berdasarkan NRP/NIP, yang baru ditambah, dan yang tidak ada lagi di file dihapus (data yang Anda ubah sendiri tidak ditimpa).`)) return;
    setMengimpor(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const r = await fetch("/api/personil/impor", { method: "POST", body: fd });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Gagal mengimpor.");
      info(`${j.total} baris: ${j.baru} baru, ${j.diperbarui} diperbarui, ${j.dihapus} dihapus`);
      muat();
    } catch (e) {
      alert((e as Error).message);
    }
    setMengimpor(false);
  }

  const kosongAlamat = kind === "lokasi" ? (all ?? []).filter((x) => !(x as Lokasi).alamat).length : 0;
  async function jalankanLengkapi() {
    if (!confirm(`AI akan mencoba mengisi alamat untuk ${kosongAlamat} lokasi yang kosong. Hanya yang AI yakin yang diisi, dan semuanya ditandai "perlu verifikasi". Lanjut?`)) return;
    setLengkapi(true);
    let terisi = 0;
    let dilewati = 0;
    try {
      for (let putaran = 0; putaran < 40; putaran++) {
        const r = await fetch("/api/sync", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ lengkapiAlamat: true }) });
        const j = await r.json();
        if (!r.ok) throw new Error(j.error ?? "Gagal.");
        terisi += j.terisi;
        dilewati += j.dilewati;
        await muat();
        if (j.sisa <= 0 || j.diperiksa === 0) break;
      }
      info(`${terisi} alamat terisi, ${dilewati} dilewati`);
    } catch (e) {
      alert((e as Error).message);
    }
    setLengkapi(false);
  }

  const adaFilter = q || kat || tingkat || asal || statusAlamat || pangkat || dari || sampai;
  return (
    <>
      <h1>{meta.judul}</h1>
      <p className="sub">{meta.sub}</p>

      <div className="chips">
        <button className={`chip${!kat ? " on" : ""}`} onClick={() => { setKat(""); setTingkat(""); }}>Semua<span className="n">{all?.length ?? 0}</span></button>
        {meta.kategori.map((k) => (
          <button key={k.key} className={`chip${kat === k.key ? " on" : ""}`} onClick={() => { setKat(k.key); setTingkat(""); }}>
            {k.label}<span className="n">{hitungKat[k.key] ?? 0}</span>
          </button>
        ))}
      </div>
      {kind === "orang" && kat === "pejabat" && (
        <div className="chips">
          <button className={`chip${!tingkat ? " on" : ""}`} onClick={() => setTingkat("")}>Semua tingkat</button>
          {TINGKAT_PEJABAT.map((t) => (
            <button key={t.key} className={`chip${tingkat === t.key ? " on" : ""}`} onClick={() => setTingkat(t.key)}>{t.label}</button>
          ))}
        </div>
      )}

      <div className="toolbar">
        <input type="search" className="search" placeholder={meta.cari} value={q} onChange={(e) => setQ(e.target.value)} />
        {kind !== "personil" && <input type="date" value={dari} onChange={(e) => setDari(e.target.value)} aria-label="Dari tanggal" />}
        {kind !== "personil" && <input type="date" value={sampai} onChange={(e) => setSampai(e.target.value)} aria-label="Sampai tanggal" />}
        {kind === "personil" && (
          <select value={pangkat} onChange={(e) => setPangkat(e.target.value)} aria-label="Pangkat">
            <option value="">Semua pangkat</option>
            {pangkatAda.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        )}
        <select value={asal} onChange={(e) => setAsal(e.target.value)} aria-label="Asal data">
          <option value="">Semua asal</option>
          {kind === "personil" ? <option value="excel">Dari Excel</option> : <option value="laporan">Dari laporan</option>}
          <option value="whatsapp">Dari WhatsApp</option>
          <option value="web">Catatan web</option>
          <option value="manual">Input manual</option>
        </select>
        {kind === "lokasi" && (
          <select value={statusAlamat} onChange={(e) => setStatusAlamat(e.target.value)} aria-label="Status alamat">
            <option value="">Semua alamat</option>
            <option value="ada">Ada alamat</option>
            <option value="kosong">Belum ada alamat</option>
            <option value="ai">AI · perlu verifikasi</option>
          </select>
        )}
        <select value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Urutan">
          {meta.urut.map((u) => <option key={u.key} value={u.key}>{u.label}</option>)}
        </select>
        {adaFilter && <button className="btn" onClick={() => { setQ(""); setKat(""); setTingkat(""); setAsal(""); setStatusAlamat(""); setPangkat(""); setDari(""); setSampai(""); }}>Reset</button>}
      </div>
      <div className="toolbar">
        <button className="btn primary" onClick={() => setEdit(kosong(kind, kat))}>+ {meta.tambah}</button>
        <button className="btn" onClick={salin} disabled={!tampil.length}>Salin sebagai teks</button>
        <button className="btn" onClick={unduh} disabled={!tampil.length}>Unduh CSV</button>
        {kind === "personil" && (
          <label className={`btn${mengimpor ? " disabled" : ""}`} style={{ cursor: "pointer" }}>
            {mengimpor ? "Mengimpor…" : "Impor Excel"}
            <input type="file" accept=".xls,.xlsx" hidden disabled={mengimpor} onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) impor(f); }} />
          </label>
        )}
        {kind === "lokasi" && (
          <button className="btn" disabled={lengkapi} onClick={jalankanLengkapi} title="Isi alamat yang kosong memakai AI; hasilnya ditandai perlu verifikasi">
            {lengkapi ? "Melengkapi alamat…" : `Lengkapi alamat (AI)${kosongAlamat ? ` · ${kosongAlamat}` : ""}`}
          </button>
        )}
        <span className="muted small">{all ? `${tampil.length} dari ${all.length}` : ""}</span>
      </div>

      {err && <div className="note bad">{err}</div>}
      {!all && !err && <p className="muted">Memuat…</p>}
      {all && (
        <div className="tablewrap">
          <table>
            <thead>{kolomHead(kind)}</thead>
            <tbody>
              {tampil.map((it) => (
                <tr key={it.id} onClick={() => setEdit(it)}>{kolomBody(kind, it)}</tr>
              ))}
            </tbody>
          </table>
          {tampil.length === 0 && (
            <div className="empty">{all.length === 0 ? "Belum ada data. Jalankan sinkronisasi di Beranda atau tambah manual." : "Tidak ada data yang cocok dengan pencarian."}</div>
          )}
        </div>
      )}

      {edit && <Form kind={kind} awal={edit} onClose={() => setEdit(null)} onSimpan={simpan} onHapus={hapus} />}
      {toast && <div className="toast">{toast}</div>}
    </>
  );
}

function kosong(kind: Kind, kat: string): Partial<Item> {
  if (kind === "personil") return { nama: "", pangkat: "", nrp: "", jabatan: "", unit: kat || "Lainnya", keterangan: "" } as Partial<Personil>;
  if (kind === "lokasi") return { nama: "", kategori: kat || "Lainnya", alamat: "", kelurahan: "", keterangan: "", alias: [] } as Partial<Lokasi>;
  if (kind === "orang") return { nama: "", kategori: (kat || "tokoh-masyarakat") as Orang["kategori"], tingkat: "", jabatan: "", instansi: "", wilayah: "", rt: "", rw: "", keterangan: "" };
  return { jenis: (kat || "lainnya") as Kejadian["jenis"], judul: "", tanggal: new Date().toISOString().slice(0, 10), waktu: "", lokasi: "", uraian: "", akibat: "", tindak_lanjut: "" };
}

function kolomHead(kind: Kind) {
  const h = kind === "personil" ? ["No", "Nama", "Pangkat", "NRP / NIP", "Jabatan", "Unit"] : kind === "lokasi" ? ["Nama", "Kategori", "Alamat", "Terakhir"] : kind === "orang" ? ["Nama", "Kategori", "Jabatan", "Wilayah / instansi", "Terakhir"] : ["Tanggal", "Jenis", "Kejadian", "Akibat"];
  return <tr>{h.map((x) => <th key={x}>{x}</th>)}</tr>;
}

function kolomBody(kind: Kind, it: Item) {
  if (kind === "personil") {
    const p = it as Personil;
    return (
      <>
        <td className="small muted">{p.no}</td>
        <td><div className="t">{p.nama}</div>{p.keterangan && <div className="alias">{p.keterangan}</div>}</td>
        <td>{p.pangkat}</td>
        <td className="small" style={{ whiteSpace: "nowrap" }}>{p.nrp}<div className="alias">{p.status}</div></td>
        <td>{p.jabatan}</td>
        <td><span className="badge">{p.unit}</span></td>
      </>
    );
  }
  if (kind === "lokasi") {
    const l = it as Lokasi;
    return (
      <>
        <td><div className="t">{l.nama}</div>{l.alias.length > 0 && <div className="alias">{l.alias.join(", ")}</div>}</td>
        <td><span className="badge">{l.kategori}</span></td>
        <td>{l.alamat || <span className="muted">— belum ada alamat</span>}{l.alamat_ai && <div><span className="badge warn">AI · perlu verifikasi</span></div>}{l.kelurahan && !l.alamat ? <div className="alias">Kel. {l.kelurahan}</div> : null}</td>
        <td className="small muted" style={{ whiteSpace: "nowrap" }}>{tgl(l.terakhir)}<br />{l.sebutan}× disebut</td>
      </>
    );
  }
  if (kind === "orang") {
    const o = it as Orang;
    const rtrw = [o.rt && `RT ${o.rt}`, o.rw && `RW ${o.rw}`].filter(Boolean).join(" / ");
    return (
      <>
        <td><div className="t">{o.nama}</div></td>
        <td><span className="badge">{labelOrang(o.kategori)}</span>{o.tingkat && <div className="alias">{labelTingkat(o.tingkat)}</div>}</td>
        <td>{o.jabatan}</td>
        <td className="small">{[...new Set([rtrw, o.wilayah, o.instansi].filter(Boolean))].join(" · ")}</td>
        <td className="small muted" style={{ whiteSpace: "nowrap" }}>{tgl(o.terakhir)}<br />{o.sebutan}× disebut</td>
      </>
    );
  }
  const e = it as Kejadian;
  return (
    <>
      <td className="small" style={{ whiteSpace: "nowrap" }}>{tgl(e.tanggal)}{e.waktu && <div className="alias">{e.waktu}</div>}</td>
      <td><span className="badge">{labelKejadian(e.jenis)}</span></td>
      <td><div className="t">{e.judul}</div>{e.lokasi && <div className="alias">{e.lokasi}</div>}<div className="small">{e.uraian}</div></td>
      <td className="small">{e.akibat}</td>
    </>
  );
}

function Teks({ label, v, set, area, tipe }: { label: string; v: unknown; set: (s: string) => void; area?: boolean; tipe?: string }) {
  return (
    <div className="field">
      <label>{label}</label>
      {area ? <textarea rows={3} value={String(v ?? "")} onChange={(e) => set(e.target.value)} /> : <input type={tipe ?? "text"} value={String(v ?? "")} onChange={(e) => set(e.target.value)} />}
    </div>
  );
}

function Pilih({ label, v, set, opsi }: { label: string; v: string; set: (s: string) => void; opsi: Opsi[] }) {
  return (
    <div className="field">
      <label>{label}</label>
      <select value={v} onChange={(e) => set(e.target.value)}>
        {opsi.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
      </select>
    </div>
  );
}

function Form({ kind, awal, onClose, onSimpan, onHapus }: { kind: Kind; awal: Partial<Item>; onClose: () => void; onSimpan: (i: Partial<Item>) => Promise<void>; onHapus: (i: Partial<Item>) => void }) {
  const [d, setD] = useState<Record<string, unknown>>({ ...awal, alias: Array.isArray((awal as Lokasi).alias) ? (awal as Lokasi).alias.join(", ") : "" });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const f = (k: string) => (s: string) => setD((p) => ({ ...p, [k]: s }));
  const baru = !awal.id;
  const sumber = ((awal as { sumber?: string[] }).sumber ?? []).filter((s) => !s.startsWith("catatan:"));
  const dariCatatan = ((awal as { sumber?: string[] }).sumber ?? []).some((s) => s.startsWith("catatan:"));

  async function kirim(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    try {
      await onSimpan(d as Partial<Item>);
    } catch (x) {
      setErr((x as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form className="modal" onSubmit={kirim}>
        <h2>{baru ? "Tambah data" : "Ubah data"}</h2>
        {kind === "lokasi" && (
          <>
            <Teks label="Nama tempat" v={d.nama} set={f("nama")} />
            <div className="row field"><Pilih label="Kategori" v={String(d.kategori)} set={f("kategori")} opsi={META.lokasi.kategori} /><Teks label="Kelurahan" v={d.kelurahan} set={f("kelurahan")} /></div>
            <Teks label="Alamat lengkap" v={d.alamat} set={f("alamat")} area />
            {(awal as Lokasi).alamat_ai && d.alamat === (awal as Lokasi).alamat && (
              <p className="small" style={{ marginTop: -6 }}>
                <span className="badge warn">AI · perlu verifikasi</span> Alamat ini diisi AI, bukan dari laporan. Periksa, lalu{" "}
                <button type="button" className="btn small" onClick={() => setD((p) => ({ ...p, terverifikasi: true }))}>{d.terverifikasi ? "Ditandai terverifikasi ✓" : "Tandai terverifikasi"}</button>
              </p>
            )}
            <Teks label="Nama lain / singkatan (pisahkan koma)" v={d.alias} set={f("alias")} />
            <Teks label="Keterangan" v={d.keterangan} set={f("keterangan")} area />
          </>
        )}
        {kind === "orang" && (
          <>
            <Teks label="Nama (beserta gelar)" v={d.nama} set={f("nama")} />
            <div className="row field">
              <Pilih label="Kategori" v={String(d.kategori)} set={f("kategori")} opsi={META.orang.kategori} />
              {d.kategori === "pejabat" && <Pilih label="Tingkat" v={String(d.tingkat || "lainnya")} set={f("tingkat")} opsi={TINGKAT_PEJABAT.map((t) => ({ key: t.key, label: t.label }))} />}
            </div>
            <Teks label="Jabatan" v={d.jabatan} set={f("jabatan")} />
            <div className="row field"><Teks label="Instansi / organisasi" v={d.instansi} set={f("instansi")} /><Teks label="Wilayah / kelurahan" v={d.wilayah} set={f("wilayah")} /></div>
            {d.kategori === "rt-rw" && <div className="row field"><Teks label="RT" v={d.rt} set={f("rt")} /><Teks label="RW" v={d.rw} set={f("rw")} /></div>}
            <Teks label="Keterangan" v={d.keterangan} set={f("keterangan")} area />
          </>
        )}
        {kind === "personil" && (
          <>
            <Teks label="Nama" v={d.nama} set={f("nama")} />
            <div className="row field"><Teks label="Pangkat" v={d.pangkat} set={f("pangkat")} /><Teks label="NRP / NIP" v={d.nrp} set={f("nrp")} /></div>
            <Teks label="Jabatan" v={d.jabatan} set={f("jabatan")} />
            <Pilih label="Unit" v={String(d.unit || "Lainnya")} set={f("unit")} opsi={META.personil.kategori} />
            <Teks label="Keterangan" v={d.keterangan} set={f("keterangan")} area />
          </>
        )}
        {kind === "kejadian" && (
          <>
            <div className="row field"><Pilih label="Jenis" v={String(d.jenis)} set={f("jenis")} opsi={META.kejadian.kategori} /><Teks label="Tanggal" tipe="date" v={d.tanggal} set={f("tanggal")} /><Teks label="Waktu" v={d.waktu} set={f("waktu")} /></div>
            <Teks label="Judul" v={d.judul} set={f("judul")} />
            <Teks label="Lokasi kejadian" v={d.lokasi} set={f("lokasi")} />
            <Teks label="Uraian" v={d.uraian} set={f("uraian")} area />
            <Teks label="Akibat / korban" v={d.akibat} set={f("akibat")} />
            <Teks label="Tindak lanjut" v={d.tindak_lanjut} set={f("tindak_lanjut")} area />
          </>
        )}
        {!baru && (sumber.length > 0 || dariCatatan) && (
          <div className="field">
            <label>Disebut di laporan</label>
            <div className="small">
              {sumber.slice(0, 12).map((s, i) => <span key={s}><Link href={`/laporan/${s}`}>laporan {i + 1}</Link>{i < Math.min(sumber.length, 12) - 1 ? ", " : ""}</span>)}
              {sumber.length > 12 && ` … +${sumber.length - 12}`}
              {dariCatatan && <span>{sumber.length ? ", " : ""}catatan WhatsApp/web</span>}
            </div>
          </div>
        )}
        {err && <p className="err">{err}</p>}
        <div className="actions">
          {!baru && <button type="button" className="btn danger left" onClick={() => onHapus(awal)}>Hapus</button>}
          <button type="button" className="btn" onClick={onClose}>Batal</button>
          <button className="btn primary" disabled={busy}>Simpan</button>
        </div>
      </form>
    </div>
  );
}
