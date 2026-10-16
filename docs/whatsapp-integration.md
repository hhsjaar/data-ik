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

## Tool di levelupaiagent

Sudah dipasang di `agen-pribadi/lib/tools/dataik.ts` (terdaftar di `lib/tools/index.ts`):

| Tool | Fungsi |
|---|---|
| `dataik_search` | Cari/baca lokasi, orang, kejadian, personil (daftar nominatif Polsek), atau catatan di Data IK (`kind`, `q`, `kategori`, `tingkat`, `jenis`, `dari`, `sampai`). |
| `dataik_add_note` | Simpan catatan teks; otomatis dipilah menjadi lokasi / orang / kejadian. Diblokir untuk tugas terjadwal (mode otomatis). |

Keduanya hanya tersedia untuk nomor pemilik (tidak ada di daftar `VIEWER_TOOLS`).
Isi `.env.local` / environment agen:

```
DATAIK_URL=https://<situs-data-ik>.vercel.app
DATAIK_AGENT_TOKEN=<sama dengan AGENT_TOKEN di Data IK>
```

Contoh pesan WhatsApp: "catat Ketua RW 05 Kelurahan Sendangmulyo bernama Pak Slamet", "alamat RS Wongsonegoro?",
"siapa camat Tembalang?", "kejadian kebakaran bulan ini".

## Catatan keamanan

- Data berisi informasi intelijen: jalankan Data IK di server yang Anda kendalikan, isi `ACCESS_CODE`, dan pakai HTTPS bila diakses dari luar jaringan.
- Folder `data/` (hasil olahan) dan `.env.local` sudah masuk `.gitignore`; jangan di-commit.
