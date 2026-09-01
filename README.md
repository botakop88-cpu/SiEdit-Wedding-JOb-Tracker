# SiEdit Web — Wedding Job Tracker

Aplikasi web untuk mengelola job editing foto/video pre-wedding & wedding, vendor, dan invoice bagi editor freelance. Dibangun dengan React 19 + TypeScript + Vite + Tailwind CSS + Supabase.

## Fitur

| Fitur | Deskripsi |
|-------|-----------|
| **Dashboard** | Ringkasan statistik: total job, piutang, deadline hari ini, pendapatan bulan ini |
| **Deadline Terdekat** | Lihat job dengan deadline ≤ 3 hari, filter warna merah/oranye/hijau |
| **Aktivitas Terbaru** | Feed 10 job terakhir yang diinput/diedit |
| **Manajemen Job** | CRUD job, filter (status bayar, status edit, deadline), search, bulk action |
| **Pengelompokan per Vendor** | Job otomatis dikelompokkan berdasarkan vendor, lihat total & piutang per vendor |
| **Bulk Action** | Pilih banyak job sekaligus → Tandai Lunas / Tandai Belum Bayar / Hapus |
| **Manajemen Vendor** | CRUD vendor dengan konfigurasi harga per jenis edit (Kolase Sudah Pilih / Belum Pilih / Edit Full) |
| **Statistik Vendor** | Setiap vendor menampilkan jumlah job, total pendapatan, dan total piutang otomatis |
| **Invoice** | Pilih vendor → centang job belum bayar → generate & cetak invoice PDF langsung dari browser |
| **Riwayat Invoice** | Riwayat invoice dengan toggle status bayar, cetak ulang, soft delete |
| **Sync Job-Invoice** | Tandai invoice Lunas → semua job terkait otomatis ikut Lunas (dan sebaliknya) |
| **Laporan Penghasilan** | Grafik pendapatan per bulan, distribusi per jenis edit (donut chart), top 5 vendor, tabel rincian bulanan dengan Month-over-Month |
| **Export CSV** | Download data penghasilan (job lunas) sebagai CSV dalam rentang waktu tertentu |
| **Recycle Bin** | Soft delete dengan tab per tabel (job/vendor/invoice), pulihkan atau hapus permanen, kosongkan sampah |
| **Multi-User** | Login/register dengan Supabase Auth, data terisolasi per akun via RLS |
| **Reset Password** | Lupa password & reset password via email |

## Cara Penggunaan

### 1. Dashboard

Setelah login, halaman pertama menampilkan:

- **4 Kartu Statistik**: Total Job, Belum Bayar, Deadline Hari Ini, Pendapatan Bulan Ini
- **Deadline Terdekat**: Daftar job dengan deadline ≤ 3 hari yang belum selesai/lunas — warna merah (hari ini), oranye (besok), hijau (≥ 2 hari)
- **Aktivitas Terbaru**: 10 job terakhir yang dibuat/diedit

Klik item di daftar deadline atau aktivitas untuk langsung ke halaman Job.

### 2. Vendor

**Menambah Vendor:**
1. Klik **Tambah**
2. Isi Nama Vendor, WhatsApp (opsional, 10-15 digit)
3. Atur harga default per jenis edit (Kolase Sudah Pilih / Kolase Belum Pilih / Edit Full)
4. Klik **Simpan**

**Melihat Statistik Vendor:**
- Setiap kartu vendor menampilkan otomatis: jumlah job, total pendapatan (job lunas), total piutang (job belum bayar)
- Harga default akan otomatis terisi saat membuat job baru untuk vendor ini

**Menghapus Vendor:**
- Vendor hanya bisa dihapus jika tidak memiliki job aktif
- Jika masih punya job, pindahkan atau hapus job terlebih dahulu

### 3. Job

**Menambah Job:**
1. Klik **Tambah**
2. Pilih **Vendor** — harga otomatis terisi sesuai konfigurasi vendor
3. Isi Nama Project, pilih Jenis Edit (harga bisa diubah manual)
4. Atur Deadline, Status Edit, Status Cetak
5. Klik **Simpan** — status bayar dimulai dari "Belum Bayar", kelola pembayarannya lewat tombol status bayar di daftar job (lihat **Pembayaran / DP / Cicilan** di bawah)

**Filter & Cari:**
- **Search**: Cari berdasarkan nama project atau nama vendor
- **Filter dropdown**: Semua, Belum Bayar, Lunas, Sedang Edit, Deadline ≤ 3 Hari, Sudah Dikirim, Sudah Cetak, Belum Cetak
- **Filter Vendor**: Pilih vendor spesifik

**Bulk Action:**
1. Centang kotak di samping job yang ingin diproses
2. Klik **Pilih semua** untuk menandai semua job yang tampil
3. Pilih aksi: **Tandai Lunas**, **Tandai Belum Bayar**, atau **Hapus**

**Edit/Delete:**
- Klik ikon pensil untuk edit
- Klik ikon tong sampah untuk soft delete (masuk Recycle Bin)

### 4. Invoice

**Membuat Invoice:**
1. Buka tab **Buat Invoice**
2. Pilih **Vendor** — daftar job yang belum bayar akan muncul
3. Centang job yang ingin dimasukkan ke invoice (secara default semua tercentang)
4. Klik **Buat & Cetak Invoice**
5. Invoice akan terbuka di tab baru dan langsung muncul dialog print browser

**Mengelola Invoice:**
1. Buka tab **Riwayat**
2. Klik status **Belum Bayar/Lunas** untuk toggle status pembayaran
3. Klik **Cetak** untuk mencetak ulang invoice
4. Klik **Hapus** untuk soft delete

> **Catatan**: Saat status invoice diubah ke Lunas, semua job terkait otomatis ikut Lunas (dan sebaliknya).

### 5. Laporan

**Melihat Laporan:**
1. Atur rentang waktu (dari bulan/tahun — ke bulan/tahun)
2. Data akan otomatis memuat job yang sudah Lunas

**Yang Ditampilkan:**
- **Ringkasan**: Total penghasilan, jumlah job lunas, periode, perbandingan dengan periode sebelumnya
- **KPI Cards**: Rata-rata/bulan, bulan tertinggi, job/bulan, bulan aktif
- **Grafik Batang**: Pendapatan per bulan (hover untuk lihat nominal)
- **Donut Chart**: Distribusi per jenis edit (Kolase Sudah Pilih, Kolase Belum Pilih, Edit Full)
- **Top Vendor**: 5 vendor dengan kontribusi terbesar
- **Tabel Rincian**: Per bulan: jumlah job, pendapatan, perubahan Month-over-Month, indikator visual

**Export CSV:**
- Klik tombol **CSV** di samping filter
- File akan otomatis terdownload dengan format `data-lunas-siedit-YYYY-MM-YYYY-MM.csv`
- Isinya per BARIS PEMBAYARAN (bukan per job) — kalau 1 job dibayar 2x (DP lalu pelunasan), akan muncul sebagai 2 baris sesuai tanggal masing-masing diterima

### 5.5 Pembayaran / DP / Cicilan

- Klik badge status bayar (Belum Bayar/DP/Lunas) di daftar job untuk membuka modal Pembayaran
- Catat pembayaran sebagian (DP) atau penuh — status job otomatis berubah: Belum Bayar → DP → Lunas
- Riwayat tiap pembayaran tersimpan (tanggal, jumlah, catatan) dan bisa dihapus kalau salah catat
- Semua angka pendapatan (Dashboard, Laporan) dihitung dari tanggal pembayaran ini — DP yang diterima bulan ini tetap terhitung sebagai pendapatan bulan ini walau job-nya baru lunas penuh bulan depan
- Tandai invoice Lunas / bulk "Tandai Lunas" / bot Telegram `/lunas` otomatis melunasi **sisa tagihan** (bukan harga penuh) kalau job sudah pernah ada DP-nya

### 6. Pengaturan & Recycle Bin

**Kustomisasi Invoice:**
- Upload logo studio (otomatis dikecilkan, max 400px)
- Atur nama studio & catatan kaki (contoh: info rekening transfer)
- Diterapkan otomatis ke invoice yang dicetak dari halaman Invoice

**Backup Data:**
- Backup seluruh data (vendor, job, riwayat pembayaran, invoice) dibuat **otomatis tiap hari**, disimpan 14 hari terakhir
- Tombol **Backup Sekarang** untuk backup manual kapan saja
- Klik ikon download di daftar backup untuk mengunduh file JSON-nya
- **Setup awal** (sekali saja, lihat `docs/setup-cron-backup.sql`): perlu dijalankan manual di Supabase SQL Editor untuk mengaktifkan jadwal cron-nya

**Informasi Aplikasi:**
- Versi, tipe database, mode multi-user, email terdaftar
- Jumlah job/vendor/invoice aktif

**Recycle Bin:**
- 3 tab: **Job**, **Vendor**, **Invoice**
- Klik **Pulihkan** (ikon panah) untuk mengembalikan data
- Klik **Hapus Permanen** (ikon tong sampah) untuk menghapus dari database
- Klik **Kosongkan Sampah** untuk menghapus permanen semua item di recycle bin

## Tech Stack

| Lapisan | Teknologi |
|---------|-----------|
| Frontend | React 19, TypeScript, Vite, Tailwind CSS, lucide-react |
| Routing | react-router-dom v7 (SPA via `<Link>`) |
| Backend | Supabase (PostgreSQL, Auth, RLS) |
| Hosting | Vercel (static SPA) |

## Setup

### 1. Clone & Install

```bash
git clone https://github.com/botakop88-cpu/SiEdit-Wedding-JOb-Tracker.git
cd SiEdit-Wedding-JOb-Tracker
npm install
```

### 2. Database

1. Buat project di [Supabase Dashboard](https://supabase.com/dashboard)
2. Buka **SQL Editor**, jalankan isi `docs/migration.sql`
3. Buka **Authentication → Settings**, aktifkan **Email + Password**
4. (Opsional) Matikan confirm email untuk testing

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

Folder `dist/` siap di-deploy ke Vercel (hubungkan repo → auto-deploy).

## Struktur Project

```
src/
├── App.tsx              # Routing + AuthProvider
├── main.tsx             # Entry point
├── index.css            # Tailwind import
├── lib/
│   ├── supabaseClient.ts  # Supabase client (env)
│   ├── AuthContext.tsx     # Auth context & provider
│   ├── types.ts           # TypeScript interfaces & enums
│   ├── utils.ts           # Helper functions (rupiah, date, etc.)
│   └── nav.ts             # Shared nav items
├── components/
│   ├── AppLayout.tsx      # Protected layout + sidebar/bottomnav
│   ├── Sidebar.tsx        # Desktop sidebar
│   ├── BottomNav.tsx      # Mobile bottom navigation
│   └── ErrorBoundary.tsx  # Global error boundary
└── pages/
    ├── Dashboard.tsx      # Dashboard ringkasan
    ├── Jobs.tsx           # Manajemen job
    ├── Vendors.tsx        # Manajemen vendor
    ├── Invoices.tsx       # Buat & riwayat invoice
    ├── Reports.tsx        # Laporan penghasilan
    ├── Settings.tsx       # Info app & recycle bin
    ├── Login.tsx          # Halaman login
    ├── Register.tsx       # Halaman daftar
    ├── ForgotPassword.tsx # Lupa password
    └── ResetPassword.tsx  # Reset password
docs/
  migration.sql           # Schema DDL + RLS policies
```

## Keamanan

- Kredensial Supabase via **environment variable** (tidak hardcoded)
- **Multi-user** dengan Supabase Auth (email/password)
- **Row Level Security (RLS)** — setiap user hanya dapat melihat/mengubah datanya sendiri
- Soft delete di semua tabel utama (job, vendor, invoice)

## Lisensi

MIT — silakan gunakan dan modifikasi sesuai kebutuhan.
