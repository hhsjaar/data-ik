# Menyambungkan Data IK ke levelupaiagent (WhatsApp)

Data IK menyediakan folder khusus **Catatan WhatsApp** (`/catatan`) dan dua endpoint untuk agen.
Semua endpoint di bawah `/api/agent/*` memakai header `Authorization: Bearer <AGENT_TOKEN>`
(nilai `AGENT_TOKEN` ada di `.env.local` Data IK). Tanpa token, jawabannya 401.

| Endpoint | Fungsi |
|---|---|
| `POST /api/agent/catatan` | Simpan catatan teks dari WhatsApp, lalu otomatis diolah Gemini menjadi lokasi / orang / kejadian. Body: `{ "teks": "...", "pengirim": "6281..." }` |
| `GET /api/agent/catatan?limit=20` | Daftar catatan terakhir. |
| `GET /api/agent/cari?kind=lokasi\|orang\|kejadian&q=...&kategori=...&limit=20` | Cari data. Hasilnya berisi `teks` (baris siap kirim ke WhatsApp) dan `items`. |

Contoh:

```bash
curl -X POST "$DATAIK_URL/api/agent/catatan" \
  -H "Authorization: Bearer $AGENT_TOKEN" -H "Content-Type: application/json" \
  -d '{"teks":"Ketua RW 05 Kel. Sendangmulyo: Bapak Slamet. RS Ketileng beralamat di Jl. Fatmawati No. 1, Mangunharjo.","pengirim":"agen"}'
```

Balasan: `{ "ok": true, "id": "...", "hasil": {"lokasi":1,"orang":1,"kejadian":0}, "ringkas": "Catatan tersimpan. Data baru: ..." }`

## Menambah tool di levelupaiagent

Salin berkas di bawah menjadi `agen-pribadi/lib/tools/dataik.ts`, lalu daftarkan `dataikTools`
di `lib/tools/index.ts` (`TOOLS = [..., ...dataikTools]`). Tambahkan `DATAIK_URL` dan
`DATAIK_AGENT_TOKEN` ke `.env.local` agen. `dataik_cari` aman dipakai nomor hanya-baca
(tambahkan ke `VIEWER_TOOLS` bila perlu); `dataik_catat` menulis data sehingga sebaiknya hanya untuk pemilik.

```ts
import { z } from 'zod';
import { defineTool } from './types';

const base = () => (process.env.DATAIK_URL || '').replace(/\/$/, '');
const headers = () => ({ Authorization: `Bearer ${process.env.DATAIK_AGENT_TOKEN}`, 'Content-Type': 'application/json' });

export const dataikCatat = defineTool({
  name: 'dataik_catat',
  description:
    'Simpan catatan tambahan ke aplikasi Data IK (lokasi penting, orang penting, atau kejadian menonjol). Teks otomatis dipilah menjadi data terstruktur. Pakai saat pengguna berkata "catat", "tambahkan data", "simpan lokasi/orang/kejadian". Tulis ulang teks pengguna apa adanya, jangan menambah fakta.',
  jsonSchema: {
    type: 'object',
    properties: { teks: { type: 'string', description: 'Isi catatan, apa adanya dari pengguna.' } },
    required: ['teks'],
  },
  schema: z.object({ teks: z.string().min(3).max(8000) }),
  run: async (i) => {
    const r = await fetch(`${base()}/api/agent/catatan`, { method: 'POST', headers: headers(), body: JSON.stringify({ teks: i.teks, pengirim: 'whatsapp' }) });
    return r.json();
  },
});

export const dataikCari = defineTool({
  name: 'dataik_cari',
  description:
    'Cari data di aplikasi Data IK. kind=lokasi (alamat tempat penting), orang (pejabat, tokoh agama/masyarakat, RT/RW, ketua LSM), atau kejadian (kejadian menonjol). Hasil `teks` sudah berformat baris siap dikirim.',
  jsonSchema: {
    type: 'object',
    properties: {
      kind: { type: 'string', enum: ['lokasi', 'orang', 'kejadian'] },
      q: { type: 'string', description: 'Kata kunci (opsional).' },
      kategori: { type: 'string', description: 'lokasi: Pendidikan/Kesehatan/...; orang: pejabat|tokoh-agama|tokoh-masyarakat|rt-rw|ketua-lsm (opsional).' },
      jenis: { type: 'string', description: 'kejadian: kecelakaan|kebakaran|tanah-longsor|penemuan-mayat|kriminalitas|bencana-lain|lainnya (opsional).' },
      limit: { type: 'number' },
    },
    required: ['kind'],
  },
  schema: z.object({ kind: z.enum(['lokasi', 'orang', 'kejadian']), q: z.string().optional(), kategori: z.string().optional(), jenis: z.string().optional(), limit: z.number().max(100).optional() }),
  run: async (i) => {
    const p = new URLSearchParams(Object.entries(i).filter(([, v]) => v != null).map(([k, v]) => [k, String(v)]));
    const r = await fetch(`${base()}/api/agent/cari?${p}`, { headers: headers() });
    return r.json();
  },
});

export const dataikTools = [dataikCatat, dataikCari];
```

## Catatan keamanan

- Data berisi informasi intelijen: jalankan Data IK di server yang Anda kendalikan, isi `ACCESS_CODE`, dan pakai HTTPS bila diakses dari luar jaringan.
- Folder `data/` (hasil olahan) dan `.env.local` sudah masuk `.gitignore`; jangan di-commit.
