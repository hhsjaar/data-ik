-- Data IK: tabel penyimpanan. Jalankan sekali di Supabase > SQL Editor (project pembuat-laporan).
-- Setiap baris menyimpan satu dokumen JSON. RLS aktif tanpa kebijakan + hak anon/authenticated dicabut,
-- jadi kunci publik (anon) TIDAK bisa membaca/menulis. Hanya server Data IK (service_role) yang bisa.

create table if not exists public.dataik_lokasi   (id text primary key, data jsonb not null, updated_at timestamptz not null default now());
create table if not exists public.dataik_orang    (id text primary key, data jsonb not null, updated_at timestamptz not null default now());
create table if not exists public.dataik_kejadian (id text primary key, data jsonb not null, updated_at timestamptz not null default now());
create table if not exists public.dataik_catatan  (id text primary key, data jsonb not null, updated_at timestamptz not null default now());
-- id = id laporan (report_history.id) yang sudah diproses
create table if not exists public.dataik_diproses (id text primary key, data jsonb not null, updated_at timestamptz not null default now());

alter table public.dataik_lokasi   enable row level security;
alter table public.dataik_orang    enable row level security;
alter table public.dataik_kejadian enable row level security;
alter table public.dataik_catatan  enable row level security;
alter table public.dataik_diproses enable row level security;

revoke all on public.dataik_lokasi, public.dataik_orang, public.dataik_kejadian, public.dataik_catatan, public.dataik_diproses from anon, authenticated;
