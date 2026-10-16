// Jalankan sinkronisasi dari terminal terhadap server yang sedang hidup.
//   npm run sync            -> proses laporan baru/berubah
//   npm run sync -- --ulang -> proses semua laporan dari awal
//   npm run sync -- --batas=10
import { readFileSync } from "fs";

const env = Object.fromEntries(
  (() => { try { return readFileSync(".env.local", "utf8"); } catch { return ""; } })()
    .split("\n").filter((l) => l.includes("=") && !l.startsWith("#")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]),
);
const base = process.env.DATAIK_URL || "http://localhost:3000";
const args = process.argv.slice(2);
const body = { ulang: args.includes("--ulang"), batas: Number((args.find((a) => a.startsWith("--batas=")) || "").split("=")[1]) || undefined };

let cookie = "";
if (env.ACCESS_CODE) {
  const r = await fetch(`${base}/api/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kode: env.ACCESS_CODE }) });
  cookie = (r.headers.get("set-cookie") || "").split(";")[0];
}
const h = { "Content-Type": "application/json", cookie };
const mulai = await fetch(`${base}/api/sync`, { method: "POST", headers: h, body: JSON.stringify(body) });
if (!mulai.ok) { console.error(await mulai.text()); process.exit(1); }
for (;;) {
  await new Promise((r) => setTimeout(r, 3000));
  const { status } = await (await fetch(`${base}/api/sync`, { headers: h })).json();
  console.log(`${status.selesaiCount}/${status.total}  baru: ${status.baru.lokasi} lokasi, ${status.baru.orang} orang, ${status.baru.kejadian} kejadian  galat: ${status.galat.length}`);
  if (!status.berjalan) { if (status.galatUmum) console.error(status.galatUmum); break; }
}
