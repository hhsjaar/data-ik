// Salin data/dataik.json (mode berkas) ke tabel dataik_* di Supabase. Jalankan SEKALI setelah supabase/schema.sql.
//   npm run migrate
import { readFileSync } from "fs";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8").split("\n").filter((l) => l.includes("=") && !l.startsWith("#")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]),
);
const url = (env.DATAIK_SUPABASE_URL || env.REPORT_SUPABASE_URL || "").replace(/\/$/, "");
const key = env.DATAIK_SUPABASE_SERVICE_KEY;
if (!url || !key) { console.error("Isi DATAIK_SUPABASE_SERVICE_KEY di .env.local dulu."); process.exit(1); }

const db = JSON.parse(readFileSync("data/dataik.json", "utf8"));
const tabel = {
  dataik_lokasi: db.lokasi.map((x) => ({ id: x.id, data: x })),
  dataik_orang: db.orang.map((x) => ({ id: x.id, data: x })),
  dataik_kejadian: db.kejadian.map((x) => ({ id: x.id, data: x })),
  dataik_catatan: db.catatan.map((x) => ({ id: x.id, data: x })),
  dataik_diproses: Object.entries(db.diproses).map(([id, data]) => ({ id, data })),
};
for (const [nama, rows] of Object.entries(tabel)) {
  for (let i = 0; i < rows.length; i += 300) {
    const r = await fetch(`${url}/rest/v1/${nama}?on_conflict=id`, {
      method: "POST",
      headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify(rows.slice(i, i + 300)),
    });
    if (!r.ok) { console.error(nama, r.status, (await r.text()).slice(0, 300)); process.exit(1); }
  }
  console.log(`${nama}: ${rows.length} baris`);
}
