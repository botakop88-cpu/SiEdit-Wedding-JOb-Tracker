// ─── Database row types ───────────────────────────────────────────

export interface Vendor {
  id: string
  user_id: string
  nama: string
  whatsapp: string | null
  // deprecated, digantikan vendor_price_item — jangan dipakai untuk data baru
  harga_kolase_sudah_pilih: number
  harga_kolase_belum_pilih: number
  harga_edit_full: number
  created_at: string
  updated_at: string | null
  deleted_at: string | null
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

export interface Job {
  id: string
  user_id: string
  vendor_id: string | null
  nama_project: string
  jenis_edit: string // was union type, now dynamic based on vendor_price_item
  harga: number
  deadline: string | null
  status_edit: StatusEdit
  status_bayar: StatusBayar
  status_cetak: StatusCetak
  tanggal_lunas: string | null
  catatan: string | null
  created_at: string
  updated_at: string | null
  deleted_at: string | null
  // Joined field
  vendor?: Pick<Vendor, 'nama'> | null
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
  nomor: string | null // Invoice number (e.g., INV-0001)
  created_at: string
  deleted_at: string | null
}

export interface InvoiceItem {
  job_id: string
  nama_project: string
  harga: number
  jenis: string
}

// ─── Enum types ──────────────────────────────────────────────────

export type JenisEdit = string // was 'Kolase Sudah Pilih' | 'Kolase Belum Pilih' | 'Edit Full'; now dynamic from vendor_price_item
export type StatusEdit = 'Masuk' | 'Sedang Edit' | 'Revisi' | 'Selesai' | 'Sudah Dikirim'
export type StatusBayar = 'Belum Bayar' | 'Lunas'
export type StatusCetak = 'Belum Cetak' | 'Sudah Cetak'

export const JENIS_EDIT_OPTIONS: JenisEdit[] = [] // deprecated — digantikan vendor_price_item per vendor

export const STATUS_EDIT_OPTIONS: StatusEdit[] = [
  'Masuk',
  'Sedang Edit',
  'Revisi',
  'Selesai',
  'Sudah Dikirim',
]

export const STATUS_BAYAR_OPTIONS: StatusBayar[] = ['Belum Bayar', 'Lunas']
export const STATUS_CETAK_OPTIONS: StatusCetak[] = ['Belum Cetak', 'Sudah Cetak']

// ─── Filter helper ───────────────────────────────────────────────

export type JobFilter =
  | 'Semua'
  | 'Belum Bayar'
  | 'Lunas'
  | 'Sedang Edit'
  | 'Deadline ≤ 3 Hari'
  | 'Sudah Cetak'
  | 'Belum Cetak'