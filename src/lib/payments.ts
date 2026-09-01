import { supabase } from './supabaseClient'
import type { InvoicePayment } from './types'

// Satu-satunya jalur resmi untuk mengubah status pembayaran job. JANGAN update
// job.status_bayar / job.total_dibayar / job.tanggal_lunas langsung dari mana pun —
// selalu lewat fungsi-fungsi ini, supaya job.status_bayar SELALU konsisten dengan
// jumlah riwayat pembayaran (job_payment) yang sebenarnya.

// Catatan: pembayaran user SEKARANG hanya lewat invoice (record_invoice_payment).
// RPC per-job (record_job_payment / delete_job_payment / reset_job_payment) tetap
// ada di database karena dipakai bot Telegram — tapi tidak dipanggil dari web lagi.

/** Catat 1 pembayaran vendor untuk SATU invoice (batch beberapa job).
 *  Jumlah dibagikan otomatis ke job-job di dalam invoice (job tertua lunas dulu). */
export async function recordInvoicePayment(
  invoiceId: string,
  jumlah: number,
  tanggal: string,
  catatan?: string | null
): Promise<string> {
  const { data, error } = await supabase.rpc('record_invoice_payment', {
    p_invoice_id: invoiceId,
    p_jumlah: jumlah,
    p_tanggal: tanggal,
    p_catatan: catatan ?? null,
  })
  if (error) throw error
  return data as string
}

/** Ambil riwayat cicilan sebuah invoice (urutan terbaru di atas). */
export async function getInvoicePayments(invoiceId: string): Promise<InvoicePayment[]> {
  const { data, error } = await supabase
    .from('invoice_payment')
    .select('*')
    .eq('invoice_id', invoiceId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as InvoicePayment[]
}

/** Batalkan invoice yang tadinya Lunas: hapus semua pembayaran yang tercatat dari invoice ini. */
export async function reverseInvoicePayments(invoiceId: string): Promise<void> {
  const { error } = await supabase.rpc('reverse_invoice_payments', { p_invoice_id: invoiceId })
  if (error) throw error
}

/** Bantu tentukan sisa tagihan sebuah job. */
export function sisaTagihan(harga: number, totalDibayar: number): number {
  return Math.max(0, harga - (totalDibayar ?? 0))
}
