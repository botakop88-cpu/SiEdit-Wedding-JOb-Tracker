# SiEdit Web — Wedding Job Tracker

Aplikasi web untuk mengelola job editing foto/video pre-wedding & wedding, vendor, dan invoice bagi editor freelance. Dibangun dengan React 19 + TypeScript + Vite + Tailwind CSS + Supabase.

## Fitur

- **Dashboard** — ringkasan statistik (total job, piutang, deadline, pendapatan)
- **Manajemen Job** — CRUD, filter, bulk action (tandai lunas/belum bayar/hapus), pengelompokan per vendor
- **Manajemen Vendor** — CRUD, konfigurasi harga per jenis edit, statistik otomatis
- **Invoice** — generate otomatis dari job belum bayar per vendor, cetak PDF via browser
- **Pengaturan & Recycle Bin** — soft delete, pulihkan/hapus permanen
- **Multi-User** — login/daftar dengan Supabase Auth, data terisolasi per akun via RLS

## Tech Stack

| Lapisan       | Teknologi                            |
| ------------- | ------------------------------------ |
| Frontend      | React 19, TypeScript, Vite, Tailwind CSS, lucide-react |
| Routing       | react-router-dom v7 (SPA via `<Link>`) |
| Backend       | Supabase (PostgreSQL, Auth, RLS)    |
| Hosting       | Vercel (static SPA)                  |

## Setup

### 1. Clone & Install

```bash
git clone <repo-url> siedit-web
cd siedit-web
npm install
```

### 2. Database

1. Buat project di [Supabase](https://supabase.com)
2. Buka SQL Editor, jalankan isi `docs/migration.sql`
3. Aktifkan **Authentication** → Email/Password (bisa disable confirm email untuk testing)

### 3. Environment

```bash
cp .env.example .env
```

Edit `.env`:
```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

### 4. Jalankan

```bash
npm run dev
```

Akses di `http://localhost:5173`

### 5. Build & Deploy

```bash
npm run build
```

Deploy folder `dist/` ke Vercel (hubungkan repo → auto-deploy).

## Struktur Proyek

```
src/
  App.tsx              # Routing + AuthProvider
  main.tsx             # Entry point
  index.css            # Tailwind import
  lib/
    supabaseClient.ts  # Supabase client (env)
    AuthContext.tsx     # Auth context & provider
    types.ts           # TypeScript interfaces & enums
    utils.ts           # Helper functions
    nav.ts             # Shared nav items
  components/
    AppLayout.tsx      # Protected layout + sidebar/bottomnav
    Sidebar.tsx        # Desktop sidebar
    BottomNav.tsx      # Mobile bottom navigation
  pages/
    Login.tsx          # Halaman login
    Register.tsx       # Halaman daftar
    Dashboard.tsx      # Dashboard ringkasan
    Jobs.tsx           # Manajemen job
    Vendors.tsx        # Manajemen vendor
    Invoices.tsx       # Buat & riwayat invoice
    Settings.tsx       # Info app & recycle bin
docs/
  migration.sql        # Schema DDL + RLS policies
```

## Keamanan

- Kredensial Supabase via **environment variable** (tidak hardcoded)
- **Multi-user** dengan Supabase Auth (email/password)
- **Row Level Security (RLS)** — setiap user hanya dapat melihat/mengubah datanya sendiri
- Soft delete di semua tabel utama

## Lisensi

MIT — silakan gunakan dan modifikasi sesuai kebutuhan.
