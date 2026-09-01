// Edge Function: backup-dispatch
// Dijalankan terjadwal (lihat docs/migration.sql / setup-cron-backup.sql untuk cron-nya).
// Untuk setiap user, export seluruh datanya (vendor, job, riwayat pembayaran, invoice,
// daftar produk vendor) jadi 1 file JSON dan simpan ke Storage bucket privat "backups".
// Backup lama (lebih dari RETENTION_DAYS) otomatis dihapus supaya storage tidak membengkak.

import { createClient } from 'npm:@supabase/supabase-js@2'

const RETENTION_DAYS = 14

async function getSecret(
  supabase: ReturnType<typeof createClient>,
  name: string,
): Promise<string | null> {
  const { data, error } = await supabase
    .schema('vault')
    .from('decrypted_secrets')
    .select('decrypted_secret')
    .eq('name', name)
    .maybeSingle()
  if (error || !data) return null
  return data.decrypted_secret as string
}

function todayStr(): string {
  const d = new Date()
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0')
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('ok')

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  const secret = await getSecret(supabase, 'backup_dispatch_secret')
  if (!secret || req.headers.get('x-internal-secret') !== secret) {
    return new Response('unauthorized', { status: 401 })
  }

  // Ambil semua user terdaftar (bukan cuma yang punya baris user_settings, supaya
  // tidak ada yang kelewat kalau suatu saat ada user tanpa baris pengaturan).
  const { data: usersPage, error: usersErr } = await supabase.auth.admin.listUsers({ perPage: 1000 })
  if (usersErr) return new Response(`gagal ambil daftar user: ${usersErr.message}`, { status: 500 })

  const results: { user_id: string; status: string }[] = []
  const dateStr = todayStr()

  for (const u of usersPage.users) {
    try {
      const [vendorRes, jobRes, paymentRes, invoiceRes, invoicePaymentRes, priceRes] = await Promise.all([
        supabase.from('vendor').select('*').eq('user_id', u.id),
        supabase.from('job').select('*').eq('user_id', u.id),
        supabase.from('job_payment').select('*').eq('user_id', u.id),
        supabase.from('invoice').select('*').eq('user_id', u.id),
        supabase.from('invoice_payment').select('*').eq('user_id', u.id),
        supabase.from('vendor_price_item').select('*').eq('user_id', u.id),
      ])

      const vendor = vendorRes.data ?? []
      const job = jobRes.data ?? []
      const jobPayment = paymentRes.data ?? []
      const invoice = invoiceRes.data ?? []
      const invoicePayment = invoicePaymentRes.data ?? []
      const vendorPriceItem = priceRes.data ?? []

      // Lewati user yang memang belum punya data sama sekali (hemat storage)
      if (vendor.length === 0 && job.length === 0 && invoice.length === 0) {
        results.push({ user_id: u.id, status: 'dilewati (tidak ada data)' })
        continue
      }

      const backup = {
        exported_at: new Date().toISOString(),
        user_id: u.id,
        vendor,
        vendor_price_item: vendorPriceItem,
        job,
        job_payment: jobPayment,
        invoice,
        invoice_payment: invoicePayment,
      }

      const path = `${u.id}/${dateStr}.json`
      const { error: upErr } = await supabase.storage
        .from('backups')
        .upload(path, new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' }), {
          upsert: true,
        })

      if (upErr) {
        results.push({ user_id: u.id, status: `gagal upload: ${upErr.message}` })
        continue
      }

      // Bersihkan backup yang lebih tua dari RETENTION_DAYS
      const { data: files } = await supabase.storage.from('backups').list(u.id, { limit: 1000 })
      if (files) {
        const cutoff = new Date()
        cutoff.setDate(cutoff.getDate() - RETENTION_DAYS)
        const cutoffStr = cutoff.toISOString().slice(0, 10)
        const toDelete = files
          .filter((f) => f.name.endsWith('.json') && f.name.slice(0, 10) < cutoffStr)
          .map((f) => `${u.id}/${f.name}`)
        if (toDelete.length > 0) {
          await supabase.storage.from('backups').remove(toDelete)
        }
      }

      results.push({ user_id: u.id, status: 'sukses' })
    } catch (e) {
      results.push({ user_id: u.id, status: `error: ${(e as Error).message}` })
    }
  }

  return new Response(JSON.stringify({ date: dateStr, results }, null, 2), {
    headers: { 'content-type': 'application/json' },
  })
})
