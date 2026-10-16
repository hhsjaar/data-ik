// Jalankan sinkronisasi dari terminal terhadap server yang sedang hidup (lokal atau Vercel).
//   npm run sync                      -> proses laporan baru/berubah
//   npm run sync -- --ulang           -> proses ulang semuanya
//   DATAIK_URL=https://xxx.vercel.app npm run sync
import { readFileSync } from "fs";

const env = Object.fromEntries(
  (() => { try { return readFileSync(".env.local", "utf8"); } catch { return ""; } })()
    .split("\n").filter((l) => l.includes("=") && !l.startsWith("#")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]),
);
const base = (process.env.DATAIK_URL || "http://localhost:3000").replace(/\/$/, "");
const gen = process.argv.includes("--ulang") ? String(Date.now()) : undefined;
const kode = process.env.ACCESS_CODE || env.ACCESS_CODE;

let cookie = "";
if (kode) {
  const r = await fetch(`${base}/api/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kode }) });
  cookie = (r.headers.get("set-cookie") || "").split(";")[0];
  if (!r.ok) { console.error("Login gagal: kode akses salah."); process.exit(1); }
}
const h = { "Content-Type": "application/json", cookie };
let selesai = 0;
for (let i = 0; i < 300; i++) {
  const r = await fetch(`${base}/api/sync`, { method: "POST", headers: h, body: JSON.stringify({ gen }) });
  const j = await r.json();
  if (!r.ok) { console.error(j.error || r.status); process.exit(1); }
  selesai += j.diproses;
  console.log(`diproses ${selesai}, sisa ${j.sisa}  baru: ${j.baru.lokasi} lokasi, ${j.baru.orang} orang, ${j.baru.kejadian} kejadian  galat: ${j.galat.length}`);
  if (j.sisa === 0 || j.diproses === 0) break;
}
