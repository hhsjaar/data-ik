# Data IK

Web app untuk mengarsipkan seluruh riwayat laporan dari **pembuat-laporan** dan menghimpun data khusus
secara otomatis:

1. **Laporan** — dikelompokkan per jenis (Laporan Kegiatan, Laporan Informasi, Laporan Harian Intelijen,
   Laporan Harian Khusus, Informasi Khusus, Rencana Kegiatan, Laporan Situasi Harian), dengan pencarian,
   filter tanggal, dan urutan.
2. **Lokasi / Tempat Penting** — nama, kategori, alamat. Format salin: `- Alamat <nama> berlokasi di <alamat>`.
3. **Orang Penting** — pejabat (kementerian, provinsi, kota, kecamatan, kelurahan), tokoh agama,
   tokoh masyarakat, RT/RW, ketua LSM.
4. **Kejadian Menonjol** — kecelakaan, kebakaran, tanah longsor, penemuan mayat, kriminalitas, dll, dari Laporan Kegiatan.
5. **Catatan WhatsApp** — folder khusus untuk catatan tambahan dari levelupaiagent
   (lihat [docs/whatsapp-integration.md](docs/whatsapp-integration.md)).

Data 2–4 diekstrak otomatis oleh Gemini dari isi laporan, digabung bila orang/tempat yang sama disebut berulang,
dan bisa dikoreksi manual (data yang Anda ubah tidak ditimpa saat sinkronisasi ulang).

## Menjalankan

```bash
npm install
cp .env.example .env.local   # isi REPORT_SUPABASE_*, GEMINI_API_KEY, ACCESS_CODE, AGENT_TOKEN
npm run dev                  # http://localhost:3000
```

Buka **Beranda → Sinkronisasi** lalu klik *Proses laporan baru*, atau dari terminal:

```bash
npm run sync               # proses laporan baru / yang berubah
npm run sync -- --ulang    # proses ulang semuanya (dikerjakan per tahap)
```

Laporan baru yang dibuat di pembuat-laporan terbaca otomatis (sumbernya langsung tabel `report_history` di Supabase,
hanya dibaca) dan diolah pada sinkronisasi berikutnya.

## Konfigurasi (`.env.local`)

| Variabel | Fungsi |
|---|---|
| `REPORT_SUPABASE_URL`, `REPORT_SUPABASE_KEY` | Supabase milik pembuat-laporan (sama dengan `NEXT_PUBLIC_SUPABASE_URL` / `..._PUBLISHABLE_KEY` di sana) |
| `GEMINI_API_KEY`, `GEMINI_MODEL` | Ekstraksi data (default `gemini-3.6-flash`) |
| `ACCESS_CODE` | Kode masuk web. Kosong = tanpa login (hanya untuk lokal) |
| `AGENT_TOKEN` | Token Bearer untuk `/api/agent/*` (levelupaiagent) |
| `DATAIK_SUPABASE_SERVICE_KEY` | Kunci service_role; mengaktifkan penyimpanan Supabase (produksi) |

## Penyimpanan

- **Lokal** (default): `data/dataik.json` (diabaikan git).
- **Produksi / Vercel**: isi `DATAIK_SUPABASE_SERVICE_KEY` → data disimpan di tabel `dataik_*` Supabase
  ([supabase/schema.sql](supabase/schema.sql)). Langkah lengkap: [docs/deploy-vercel.md](docs/deploy-vercel.md).

## Keamanan

Data berisi informasi intelijen. `.env.local` dan `data/` tidak pernah di-commit. Jalankan di server yang Anda
kendalikan dan isi `ACCESS_CODE`.
