// Edge Function: backup-now
// Dipicu MANUAL oleh tombol "Backup Sekarang" di halaman Pengaturan (web).
// Beda dengan backup-dispatch (terjadwal, semua user, otentikasi pakai secret internal),
// fungsi ini backup 1 user saja — user yang sedang login, diverifikasi lewat JWT yang
// dikirim otomatis oleh supabase-js saat memanggil functions.invoke().

import { createClient } from 'npm:@supabase/supabase-js@2'

function todayStr(): string {
  const d = new Date()
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0')
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('ok')

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return new Response('unauthorized', { status: 401 })

  // Client dengan JWT user (untuk verifikasi identitas), dan client service role
  // (untuk baca-tulis lintas tabel tanpa terhambat RLS, setelah identitas terverifikasi).
  const supabaseAuth = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } },
  )
  const { data: userData, error: userErr } = await supabaseAuth.auth.getUser()
  if (userErr || !userData.user) return new Response('unauthorized', { status: 401 })
  const uid = userData.user.id

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  const [vendorRes, jobRes, paymentRes, invoiceRes, invoicePaymentRes, priceRes] = await Promise.all([
    supabase.from('vendor').select('*').eq('user_id', uid),
    supabase.from('job').select('*').eq('user_id', uid),
    supabase.from('job_payment').select('*').eq('user_id', uid),
    supabase.from('invoice').select('*').eq('user_id', uid),
    supabase.from('invoice_payment').select('*').eq('user_id', uid),
    supabase.from('vendor_price_item').select('*').eq('user_id', uid),
  ])

  const backup = {
    exported_at: new Date().toISOString(),
    user_id: uid,
    vendor: vendorRes.data ?? [],
    vendor_price_item: priceRes.data ?? [],
    job: jobRes.data ?? [],
    job_payment: paymentRes.data ?? [],
    invoice: invoiceRes.data ?? [],
    invoice_payment: invoicePaymentRes.data ?? [],
  }

  const path = `${uid}/${todayStr()}.json`
  const { error: upErr } = await supabase.storage
    .from('backups')
    .upload(path, new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' }), {
      upsert: true,
    })

  if (upErr) {
    return new Response(JSON.stringify({ error: upErr.message }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    })
  }

  return new Response(JSON.stringify({ ok: true, path }), {
    headers: { 'content-type': 'application/json' },
  })
})
