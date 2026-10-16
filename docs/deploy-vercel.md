# Deploy Data IK ke Vercel

Penyimpanan produksi memakai Supabase (tabel `dataik_*`), bukan berkas lokal.

## 1. Buat tabel (sekali)

Supabase → project **pembuat-laporan** → *SQL Editor* → tempel isi [`supabase/schema.sql`](../supabase/schema.sql) → *Run*.
Tabel dibuat dengan RLS aktif dan hak `anon`/`authenticated` dicabut, jadi kunci publik tidak bisa membacanya.

## 2. Ambil kunci service_role

Supabase → *Project Settings → API Keys* → salin **service_role** (rahasia). Jangan dibagikan atau di-commit.

## 3. Pindahkan data yang sudah ada (sekali, dari komputer Anda)

Tambahkan ke `.env.local`:

```
DATAIK_SUPABASE_SERVICE_KEY=<service_role>
```

```bash
npm run migrate
```

Setelah ini `npm run dev` lokal juga memakai Supabase (hapus baris itu bila ingin kembali ke berkas lokal).

## 4. Deploy

Vercel → *Add New Project* → impor `hhsjaar/data-ik` → isi Environment Variables:

| Nama | Nilai |
|---|---|
| `REPORT_SUPABASE_URL` | sama seperti `.env.local` |
| `REPORT_SUPABASE_KEY` | sama seperti `.env.local` (kunci publik, hanya baca laporan) |
| `DATAIK_SUPABASE_SERVICE_KEY` | kunci service_role |
| `GEMINI_API_KEY` | kunci Gemini |
| `GEMINI_MODEL` | `gemini-3.6-flash` |
| `ACCESS_CODE` | kode masuk web (WAJIB di produksi) |
| `AGENT_TOKEN` | token untuk levelupaiagent |

Tidak ada variabel yang boleh berawalan `NEXT_PUBLIC_`.

## 5. Setelah deploy

- Buka situs → masuk dengan `ACCESS_CODE`. Laporan baru diproses lewat Beranda → *Proses laporan baru*
  (halaman memanggil server berulang sampai selesai; biarkan tab terbuka), atau dari terminal:
  `DATAIK_URL=https://<situs>.vercel.app npm run sync`.
- Di levelupaiagent isi `DATAIK_URL=https://<situs>.vercel.app` dan `DATAIK_AGENT_TOKEN` (lihat `docs/whatsapp-integration.md`).

## Catatan

- Fungsi dibatasi ±60 detik; sinkronisasi dan *Lengkapi alamat (AI)* sengaja dikerjakan per tahap kecil.
- Dua orang yang menyimpan data pada detik yang sama bisa saling menimpa baris yang sama (jarang terjadi untuk satu pengguna).
