// ─── Database row types ───────────────────────────────────────────

export interface Vendor {
  id: string
  user_id: string
  nama: string
  whatsapp: string | null
  harga_kolase_sudah_pilih: number
  harga_kolase_belum_pilih: number
  harga_edit_full: number
  created_at: string
  updated_at: string | null
  deleted_at: string | null
}

export interface Job {
  id: string
  user_id: string
  vendor_id: string | null
  nama_project: string
  jenis_edit: string
  harga: number
  deadline: string | null
  status_edit: StatusEdit
  status_bayar: StatusBayar
  status_cetak: StatusCetak
  tanggal_lunas: string | null
  total_dibayar: number
  catatan: string | null
  created_at: string
  updated_at: string | null
  deleted_at: string | null
  // Joined field
  vendor?: Pick<Vendor, 'nama'> | null
}

// Riwayat tiap kali ada pembayaran (DP/cicilan/pelunasan) untuk 1 job.
// job.total_dibayar & job.status_bayar SELALU dihitung ulang dari jumlah baris-baris
// ini (lewat fungsi database record_job_payment/delete_job_payment) — jangan pernah
// diubah manual dari frontend, supaya tidak ada 2 sumber data yang bisa beda lagi.
export interface JobPayment {
  id: string
  user_id: string
  job_id: string
  invoice_id: string | null
  invoice_payment_id: string | null
  jumlah: number
  tanggal: string
  catatan: string | null
  created_at: string
}

export interface VendorPriceItem {
  id: string
  vendor_id: string
  user_id: string
  nama_produk: string
  harga: number
  urutan: number
  created_at: string
  updated_at: string | null
}

export interface Invoice {
  id: string
  user_id: string
  vendor_id: string | null
  vendor_nama: string
  tanggal: string
  items_json: string
  total: number
  status_bayar: StatusBayar
  pdf_path: string | null
  nomor: string | null
  created_at: string
  deleted_at: string | null
}

export interface InvoiceItem {
  job_id: string
  nama_project: string
  harga: number
  jenis: string
}

export interface InvoicePayment {
  id: string
  user_id: string
  invoice_id: string
  jumlah: number
  tanggal: string
  catatan: string | null
  created_at: string
}

export interface UserSettings {
  id: string
  user_id: string
  telegram_chat_id: string | null
  telegram_connect_code: string | null
  telegram_connect_expires: string | null
  notif_jam: string | null
  nama_studio: string | null
  invoice_logo_url: string | null
  invoice_footer: string | null
  created_at: string
  updated_at: string | null
}

// ─── Enum types ──────────────────────────────────────────────────

// Catatan: 3 nilai ini adalah sisa dari versi lama sebelum ada "Daftar Produk / Harga"
// per-vendor yang bebas diisi. Form Tambah/Edit Job SUDAH TIDAK memakai daftar ini —
// Jenis Edit sekarang selalu mengikuti persis apa yang diisi di menu Vendor.
export type JenisEdit = 'Kolase Sudah Pilih' | 'Kolase Belum Pilih' | 'Edit Full'
export type StatusEdit = 'Masuk' | 'Sedang Edit' | 'Revisi' | 'Selesai'
// 'DP' = sudah dibayar sebagian (total_dibayar > 0 tapi < harga)
export type StatusBayar = 'Belum Bayar' | 'DP' | 'Lunas'
export type StatusCetak = 'Belum Cetak' | 'Sudah Dikirim' | 'Sudah Cetak'

export const JENIS_EDIT_OPTIONS: JenisEdit[] = [
  'Kolase Sudah Pilih',
  'Kolase Belum Pilih',
  'Edit Full',
]

export const STATUS_EDIT_OPTIONS: StatusEdit[] = [
  'Masuk',
  'Sedang Edit',
  'Revisi',
  'Selesai',
]

export const STATUS_BAYAR_OPTIONS: StatusBayar[] = ['Belum Bayar', 'DP', 'Lunas']
export const STATUS_CETAK_OPTIONS: StatusCetak[] = ['Belum Cetak', 'Sudah Dikirim', 'Sudah Cetak']

// ─── Filter helper ───────────────────────────────────────────────

export type JobFilter =
  | 'Semua'
  | 'Belum Bayar'
  | 'DP'
  | 'Lunas'
  | 'Sedang Edit'
  | 'Deadline ≤ 3 Hari'
  | 'Sudah Dikirim'
  | 'Sudah Cetak'
  | 'Belum Cetak'