import { createClient } from 'npm:@supabase/supabase-js@2'

const TELEGRAM_API = 'https://api.telegram.org'
const SEP = '——————————————'
const BULAN_ID = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']
const BULAN_ID_FULL = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']
const BULAN_CARI: Record<string, number> = (() => {
  const m: Record<string, number> = {}
  BULAN_ID.forEach((b, i) => { m[b.toLowerCase()] = i + 1 })
  BULAN_ID_FULL.forEach((b, i) => { m[b.toLowerCase()] = i + 1 })
  return m
})()

const STATUS_EDIT = ['Masuk', 'Sedang Edit', 'Revisi', 'Selesai']
const STATUS_BAYAR = ['Belum Bayar', 'Lunas']
const STATUS_CETAK = ['Belum Cetak', 'Sudah Dikirim', 'Sudah Cetak']

type WizardData = {
  mode?: 'tambah' | 'buatinvoice' | 'bayar_invoice'
  nama_project?: string
  vendor_id?: string
  vendor_list?: { id: string; nama: string }[]
  jenis_edit?: string
  jenis_list?: { jenis: string; harga: number }[]
  harga?: number
  deadline?: string | null
  status_edit?: string
  status_bayar?: string
  status_cetak?: string
  catatan?: string | null
  invoice_vendor_id?: string
  invoice_vendor_list?: { id: string; nama: string; job_count: number }[]
  invoice_jobs?: { id: string; nama_project: string; sisa: number; jenis_edit: string }[]
  invoice_selected?: number[]
  invoice_confirm?: { vendor_nama: string; total: number; items: string[] }
  invoice_list?: { id: string; nomor: string; vendor_nama: string; total: number; sisa: number; status_bayar: string; tanggal: string }[]
  invoice_pick?: number
  bayar_jumlah?: number
  bayar_tanggal?: string
}

function fmtRupiah(n: number): string {
  return 'Rp' + (n ?? 0).toLocaleString('id-ID')
}

function formatDate(iso?: string | null): string {
  if (!iso) return '-'
  const d = new Date(iso.length === 10 ? iso + 'T00:00:00' : iso)
  if (isNaN(d.getTime())) return '-'
  return `${String(d.getDate()).padStart(2, '0')} ${BULAN_ID[d.getMonth()]} ${d.getFullYear()}`
}

function parseDateInput(text: string): string | null | undefined {
  const t = text.trim()
  if (t === '-') return null

  let dd = 0
  let mm = 0
  let yy = 0

  if (/^\d{8}$/.test(t)) {
    dd = Number(t.slice(0, 2))
    mm = Number(t.slice(2, 4))
    yy = Number(t.slice(4, 8))
  } else if (/^\d{4}[-/]\d{2}[-/]\d{2}$/.test(t)) {
    yy = Number(t.slice(0, 4))
    mm = Number(t.slice(5, 7))
    dd = Number(t.slice(8, 10))
  } else if (/^\d{1,2}[-/]\d{1,2}[-/]\d{4}$/.test(t)) {
    const p = t.split(/[-/]/)
    dd = Number(p[0])
    mm = Number(p[1])
    yy = Number(p[2])
  } else {
    const m = t.match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/)
    if (!m) return undefined
    dd = Number(m[1])
    mm = BULAN_CARI[m[2].toLowerCase().replace(/\.$/, '')] ?? 0
    yy = Number(m[3])
  }

  if (mm < 1 || mm > 12 || dd < 1 || dd > 31 || yy < 1000 || yy > 9999) return undefined
  const d = new Date(Date.UTC(yy, mm - 1, dd))
  if (d.getUTCFullYear() !== yy || d.getUTCMonth() !== mm - 1 || d.getUTCDate() !== dd) return undefined
  return `${yy}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`
}

async function getSecret(
  supabase: ReturnType<typeof createClient>,
  name: string,
): Promise<string | null> {
  const { data, error } = await supabase.rpc('siedit_get_secret', { p_name: name })
  if (error || !data) return null
  return data as string
}

async function sendMessage(token: string, chatId: number, text: string) {
  await fetch(`${TELEGRAM_API}/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true }),
  })
}

async function getUserByChat(supabase: ReturnType<typeof createClient>, chatId: number) {
  const { data } = await supabase
    .from('user_settings')
    .select('*')
    .eq('telegram_chat_id', String(chatId))
    .maybeSingle()
  return data
}

const NOT_CONNECTED_TEXT =
  '🔗 Kamu belum terhubung.\n' +
  'Buka Pengaturan → Hubungkan Telegram\n' +
  'lalu kirim kode yang tampil.'

const HELP_TEXT =
  '📋 PERINTAH SiEdit\n' +
  `${SEP}\n` +
  '➕ /tambah         Tambah job baru\n' +
  '🧾 /buatinvoice    Buat invoice dari job\n' +
  '🔍 /cekinvoice     Lihat & kelola invoice\n' +
  '💳 /belumbayar     Daftar job belum bayar\n' +
  '📅 /deadline       Job mendekati deadline\n' +
  '🚫 /batal          Batalkan proses berjalan\n' +
  '❓ /help           Bantuan ini\n' +
  `${SEP}\n` +
  '🔗 Hubungkan: Pengaturan → Hubungkan Telegram'

const wizardPrompts: { field: keyof WizardData; text: string }[] = [
  { field: 'nama_project', text: 'Nama project?' },
  { field: 'vendor_id', text: 'Pilih nomor vendor:' },
  { field: 'jenis_edit', text: 'Pilih jenis edit:' },
  { field: 'deadline', text: 'Deadline? Contoh: 02082026 atau 15 Agu 2026,\natau kirim "-" jika tidak ada.' },
  { field: 'status_edit', text: 'Status edit?\n1) Masuk\n2) Sedang Edit\n3) Revisi\n4) Selesai' },
  { field: 'status_bayar', text: 'Status bayar?\n1) Belum Bayar\n2) Lunas' },
  { field: 'status_cetak', text: 'Status cetak?\n1) Belum Cetak\n2) Sudah Dikirim\n3) Sudah Cetak' },
  { field: 'catatan', text: 'Catatan? Kirim "-" jika tidak ada.' },
]

function kv(emoji: string, label: string, value: string): string {
  return `${emoji} ${label.padEnd(10)}: ${value}`
}

function promptText(step: number, data: WizardData): string {
  const header = `➕ TAMBAH JOB BARU (${step}/8)\n${SEP}\n`
  if (step === 2) {
    const list = data.vendor_list ?? []
    return header + 'Pilih nomor vendor:\n' + list.map((v, i) => `${i + 1}) ${v.nama}`).join('\n')
  }
  if (step === 3) {
    const list = data.jenis_list ?? []
    return header + 'Pilih jenis edit:\n' + list.map((j, i) => `${i + 1}) ${j.jenis} — ${fmtRupiah(j.harga)}`).join('\n')
  }
  if (step === 4) {
    const auto = data.harga ? `💰 Harga otomatis: ${fmtRupiah(data.harga)}\n\n` : ''
    return header + auto + wizardPrompts[3].text
  }
  return header + wizardPrompts[step - 1].text
}

async function handleWizard(
  supabase: ReturnType<typeof createClient>,
  token: string,
  chatId: number,
  text: string,
) {
  const user = await getUserByChat(supabase, chatId)
  if (!user || !user.wizard_step) return false

  const step = user.wizard_step as number
  const data = (user.wizard_data ?? {}) as WizardData
  const mode = data.mode ?? 'tambah'

  // Mode /buatinvoice
  if (mode === 'buatinvoice') {
    return handleBuatinvoiceWizard(supabase, token, chatId, text, user)
  }

  // Mode /bayar invoice
  if (mode === 'bayar_invoice') {
    return handleBayarInvoiceWizard(supabase, token, chatId, text, user)
  }

  const prompt = wizardPrompts[step - 1]

  // step 8 = catatan, step 9 = konfirmasi
  if (step <= 8) {
    const parsed = parseStep(supabase, step, text, user.user_id, data)
    if (!parsed.ok) {
      await sendMessage(token, chatId, parsed.error)
      return true
    }
    ;(data as Record<string, unknown>)[prompt.field] = parsed.value

    // Step 3 (jenis edit) → ambil harga otomatis dari web
    if (step === 3) {
      const jenis = data.jenis_edit
      const harga = data.jenis_list?.find((j) => j.jenis === jenis)?.harga ?? 0
      if (harga <= 0) {
        await clearWizard(supabase, user.user_id)
        await sendMessage(
          token,
          chatId,
          `⚠️ Harga untuk jenis "${jenis}" tidak valid (harus lebih dari 0).\n\nPerbaiki harga di Pengaturan Vendor di web SiEdit, lalu coba /tambah lagi.`,
        )
        return true
      }
      data.harga = harga
    }

    const nextStep = step + 1
    if (nextStep <= 8) {
      // Step 2 (vendor) → bangun daftar jenis edit sesuai harga terdaftar
      if (nextStep === 3) {
        const jenisList = await getVendorJenisList(supabase, data.vendor_id ?? '')
        if (jenisList.length === 0) {
          await clearWizard(supabase, user.user_id)
          const vname = data.vendor_list?.find((v) => v.id === data.vendor_id)?.nama ?? 'tersebut'
          await sendMessage(
            token,
            chatId,
            `⚠️ Belum ada harga terdaftar untuk vendor\n${vname}.\n\nAtur harga di Pengaturan Vendor di\nweb SiEdit, lalu coba /tambah lagi.`,
          )
          return true
        }
        data.jenis_list = jenisList
      }
      await supabase
        .from('user_settings')
        .update({ wizard_step: nextStep, wizard_data: data, updated_at: new Date().toISOString() })
        .eq('user_id', user.user_id)
      await sendMessage(token, chatId, promptText(nextStep, data))
      return true
    }

    // nextStep = 9 → konfirmasi
    await supabase
      .from('user_settings')
      .update({ wizard_step: 9, wizard_data: data, updated_at: new Date().toISOString() })
      .eq('user_id', user.user_id)
    await sendMessage(token, chatId, await confirmText(supabase, data))
    return true
  }

  // step 9 = konfirmasi
  const reply = text.toLowerCase()
  if (reply === 'batal' || reply === 'tidak' || reply === 'no') {
    await clearWizard(supabase, user.user_id)
    await sendMessage(token, chatId, '🚫 Dibatalkan.')
    return true
  }
  if (reply !== 'ya' && reply !== 'yes' && reply !== 'simpan') {
    await sendMessage(token, chatId, 'Balas "ya" untuk menyimpan,\natau "batal" untuk membatalkan.')
    return true
  }

  // status_bayar/total_dibayar/tanggal_lunas TIDAK boleh di-set langsung (invariant
  // web: selalu lewat record_job_payment/record_invoice_payment). Job disimpan sebagai
  // Belum Bayar dulu; kalau user memilih Lunas, pembayarannya dicatat setelah insert.
  const payload = {
    user_id: user.user_id,
    vendor_id: data.vendor_id || null,
    nama_project: data.nama_project,
    jenis_edit: data.jenis_edit,
    harga: data.harga ?? 0,
    deadline: data.deadline || null,
    status_edit: data.status_edit,
    status_bayar: 'Belum Bayar',
    status_cetak: data.status_cetak,
    catatan: data.catatan || null,
    tanggal_lunas: null,
    updated_at: new Date().toISOString(),
  }

  const { data: inserted, error } = await supabase.from('job').insert(payload).select('id').single()
  await clearWizard(supabase, user.user_id)
  if (error) {
    await sendMessage(token, chatId, `⚠️ Gagal menyimpan job: ${error.message}`)
    return true
  }
  if (data.status_bayar === 'Lunas' && inserted?.id) {
    const today = new Date().toISOString().slice(0, 10)
    const { error: payErr } = await supabase.rpc('record_job_payment', {
      p_job_id: inserted.id,
      p_jumlah: data.harga ?? 0,
      p_tanggal: today,
      p_catatan: 'Lunas saat dibuat lewat bot Telegram',
      p_invoice_id: null,
    })
    if (payErr) {
      await sendMessage(token, chatId, `⚠️ Job tersimpan, tapi gagal mencatat pelunasan: ${payErr.message}`)
      return true
    }
  }
  await sendMessage(token, chatId, `✅ Job "${data.nama_project}" berhasil\nditambahkan!`)
  return true
}

// Cari invoice aktif yang memuat job ini. Kalau ada, kembalikan id invoice + sisa
// tagihan invoice (agar pembayaran tidak melebihi sisa invoice).
async function resolveJobInvoice(
  supabase: ReturnType<typeof createClient>,
  jobId: string,
): Promise<{ invoice_id: string; sisa: number } | null> {
  const { data: job } = await supabase.from('job').select('vendor_id').eq('id', jobId).maybeSingle()
  if (!job?.vendor_id) return null
  const { data: invs } = await supabase
    .from('invoice')
    .select('id, total, items_json')
    .eq('vendor_id', job.vendor_id)
    .is('deleted_at', null)
  if (!invs) return null
  for (const inv of invs) {
    let items: { job_id?: string }[] = []
    try { items = JSON.parse(inv.items_json ?? '[]') } catch { items = [] }
    if (!items.some((it) => it.job_id === jobId)) continue
    const { data: payRows } = await supabase
      .from('invoice_payment')
      .select('jumlah')
      .eq('invoice_id', inv.id)
    const paid = (payRows ?? []).reduce((s, p) => s + (p.jumlah ?? 0), 0)
    const sisa = Math.max(0, (inv.total ?? 0) - paid)
    if (sisa > 0) return { invoice_id: inv.id, sisa }
    return null
  }
  return null
}

async function handleBuatinvoiceWizard(
  supabase: ReturnType<typeof createClient>,
  token: string,
  chatId: number,
  text: string,
  user: Record<string, unknown>,
) {
  const step = user.wizard_step as number
  const data = (user.wizard_data ?? {}) as WizardData

  // Step 1: Pilih vendor
  if (step === 1) {
    const n = text.trim()
    if (!/^\d+$/.test(n)) {
      await sendMessage(token, chatId, '⚠️ Kirim nomor vendor dari daftar, atau /batal.')
      return true
    }
    const idx = Number(n) - 1
    const list = data.invoice_vendor_list ?? []
    if (idx < 0 || idx >= list.length) {
      await sendMessage(token, chatId, `⚠️ Nomor tidak valid. Pilih 1-${list.length}, atau /batal.`)
      return true
    }
    const vendor = list[idx]
    data.invoice_vendor_id = vendor.id
    // Ambil job belum bayar untuk vendor ini yang belum ada di invoice aktif
    const { data: allJobs } = await supabase
      .from('job')
      .select('id, nama_project, harga, total_dibayar, jenis_edit')
      .eq('user_id', user.user_id as string)
      .eq('vendor_id', vendor.id)
      .eq('status_bayar', 'Belum Bayar')
      .is('deleted_at', null)
      .order('created_at')
    // Filter out job yang sudah ada di invoice aktif
    const { data: activeInvs } = await supabase
      .from('invoice')
      .select('items_json')
      .eq('user_id', user.user_id as string)
      .eq('vendor_id', vendor.id)
      .is('deleted_at', null)
    const invoicedJobIds = new Set<string>()
    for (const inv of activeInvs ?? []) {
      try {
        const items = JSON.parse(inv.items_json ?? '[]') as { job_id?: string }[]
        for (const it of items) { if (it.job_id) invoicedJobIds.add(it.job_id) }
      } catch { /* skip */ }
    }
    const availableJobs = (allJobs ?? [])
      .filter((j) => !invoicedJobIds.has(j.id))
      .map((j) => ({
        id: j.id,
        nama_project: j.nama_project,
        sisa: Math.max(0, (j.harga ?? 0) - (j.total_dibayar ?? 0)),
        jenis_edit: j.jenis_edit ?? '-',
      }))
      .filter((j) => j.sisa > 0)
    if (availableJobs.length === 0) {
      await clearWizard(supabase, user.user_id as string)
      await sendMessage(token, chatId, `ℹ️ Tidak ada job belum bayar untuk ${vendor.nama} yang bisa dibuat invoice.`)
      return true
    }
    data.invoice_jobs = availableJobs
    data.invoice_selected = availableJobs.map((_, i) => i) // semua terpilih
    await supabase
      .from('user_settings')
      .update({ wizard_step: 2, wizard_data: data, updated_at: new Date().toISOString() })
      .eq('user_id', user.user_id as string)
    await sendMessage(token, chatId, buildInvoiceSelectText(data))
    return true
  }

  // Step 2: Toggle job selection
  if (step === 2) {
    const t = text.trim().toLowerCase()
    const jobs = data.invoice_jobs ?? []
    const selected = [...(data.invoice_selected ?? [])]

    if (t === 'ok' || t === 'ya' || t === 'lanjut') {
      if (selected.length === 0) {
        await sendMessage(token, chatId, '⚠️ Pilih minimal 1 job. Kirim nomor untuk toggle.')
        return true
      }
      // Hitung total
      const total = selected.reduce((s, i) => s + (jobs[i]?.sisa ?? 0), 0)
      const items = selected.map((i) => `${jobs[i].nama_project} — ${fmtRupiah(jobs[i].sisa)}`)
      data.invoice_confirm = {
        vendor_nama: data.invoice_vendor_list?.find((v) => v.id === data.invoice_vendor_id)?.nama ?? '-',
        total,
        items,
      }
      await supabase
        .from('user_settings')
        .update({ wizard_step: 3, wizard_data: data, updated_at: new Date().toISOString() })
        .eq('user_id', user.user_id as string)
      const itemLines = items.map((it, i) => `${i + 1}. ${it}`).join('\n')
      await sendMessage(
        token,
        chatId,
        `📝 KONFIRMASI INVOICE\n${SEP}\n🏢 Vendor: ${data.invoice_confirm.vendor_nama}\n\n${itemLines}\n\n💰 Total: ${fmtRupiah(total)}\n\nBalas "ya" untuk menyimpan,\natau "batal" untuk membatalkan.`,
      )
      return true
    }

    // Parse toggle: "3,5" or "3" etc
    const nums = t.split(/[,\s]+/).map((s) => s.trim()).filter(Boolean)
    const toggleSet = new Set<number>()
    let valid = true
    for (const s of nums) {
      if (!/^\d+$/.test(s)) { valid = false; break }
      const n = Number(s) - 1
      if (n < 0 || n >= jobs.length) { valid = false; break }
      toggleSet.add(n)
    }
    if (!valid) {
      await sendMessage(token, chatId, '⚠️ Format salah. Kirim angka dipisah koma (contoh: 3,5),\n"ok" untuk lanjut, atau /batal.')
      return true
    }
    // Toggle
    for (const i of toggleSet) {
      const idx = selected.indexOf(i)
      if (idx >= 0) selected.splice(idx, 1)
      else selected.push(i)
    }
    selected.sort((a, b) => a - b)
    data.invoice_selected = selected
    await supabase
      .from('user_settings')
      .update({ wizard_data: data, updated_at: new Date().toISOString() })
      .eq('user_id', user.user_id as string)
    await sendMessage(token, chatId, buildInvoiceSelectText(data))
    return true
  }

  // Step 3: Konfirmasi
  if (step === 3) {
    const reply = text.toLowerCase()
    if (reply === 'batal' || reply === 'tidak' || reply === 'no') {
      await clearWizard(supabase, user.user_id as string)
      await sendMessage(token, chatId, '🚫 Dibatalkan.')
      return true
    }
    if (reply !== 'ya' && reply !== 'yes' && reply !== 'simpan') {
      await sendMessage(token, chatId, 'Balas "ya" untuk menyimpan,\natau "batal" untuk membatalkan.')
      return true
    }
    const confirm = data.invoice_confirm
    const selected = data.invoice_selected ?? []
    const jobs = data.invoice_jobs ?? []
    if (!confirm || selected.length === 0) {
      await clearWizard(supabase, user.user_id as string)
      await sendMessage(token, chatId, '⚠️ Data tidak lengkap. Coba /buatinvoice lagi.')
      return true
    }
    // Generate nomor invoice (scan ALL invoices termasuk deleted untuk hindari duplikat)
    let invNumber = ''
    let invErr: { message: string; code?: string } | null = null
    for (let attempt = 0; attempt < 5; attempt++) {
      const { data: lastInv } = await supabase
        .from('invoice')
        .select('nomor')
        .eq('user_id', user.user_id as string)
        .not('nomor', 'is', null)
        .order('created_at', { ascending: false })
        .limit(1)
      let nextNum = 1
      if (lastInv && lastInv.length > 0) {
        const lastNomor = lastInv[0].nomor ?? ''
        const m = lastNomor.match(/(\d+)$/)
        if (m) nextNum = Number(m[1]) + 1
      }
      invNumber = `INV-${String(nextNum).padStart(4, '0')}`
      const items = selected.map((i) => ({
        job_id: jobs[i].id,
        nama_project: jobs[i].nama_project,
        harga: jobs[i].sisa,
        jenis: jobs[i].jenis_edit,
      }))
      const vendorNama = data.invoice_vendor_list?.find((v) => v.id === data.invoice_vendor_id)?.nama ?? '-'
      const today = new Date().toISOString().slice(0, 10)
      const { error } = await supabase.from('invoice').insert({
        user_id: user.user_id as string,
        vendor_id: data.invoice_vendor_id,
        vendor_nama: vendorNama,
        tanggal: today,
        items_json: JSON.stringify(items),
        total: confirm.total,
        status_bayar: 'Belum Bayar',
        nomor: invNumber,
      })
      if (!error) { invErr = null; break }
      invErr = error as { message: string; code?: string }
      if (invErr.code !== '23505') break
    }
    await clearWizard(supabase, user.user_id as string)
    if (invErr) {
      await sendMessage(token, chatId, `⚠️ Gagal membuat invoice: ${invErr.message}`)
      return true
    }
    const itemLines = confirm.items.map((it, i) => `${i + 1}. ${it}`).join('\n')
    await sendMessage(
      token,
      chatId,
      `✅ INVOICE DIBUAT\n${SEP}\n` +
      kv('📋', 'Nomor', invNumber) + '\n' +
      kv('🏢', 'Vendor', vendorNama) + '\n' +
      kv('📅', 'Tanggal', formatDate(today)) + '\n' +
      kv('💰', 'Total', fmtRupiah(confirm.total)) + '\n' +
      kv('💳', 'Status', 'Belum Bayar') + '\n' +
      `${SEP}\n📌 Job:\n${itemLines}`,
    )
    return true
  }

  return false
}

function buildInvoiceSelectText(data: WizardData): string {
  const jobs = data.invoice_jobs ?? []
  const selected = new Set(data.invoice_selected ?? [])
  const total = [...selected].reduce((s, i) => s + (jobs[i]?.sisa ?? 0), 0)
  const lines = jobs.map((j, i) => {
    const check = selected.has(i) ? '✅' : '❌'
    return `${check} ${i + 1}. ${j.nama_project.padEnd(16)} ${j.jenis_edit.padEnd(10)} ${fmtRupiah(j.sisa)}`
  })
  return (
    `📋 PILIH JOB (${jobs.length} total, ${selected.size} dipilih)\n${SEP}\n` +
    lines.join('\n') + '\n' +
    `${SEP}\n💰 Total: ${fmtRupiah(total)}\n\n` +
    'Kirim angka untuk toggle (contoh: 2,4)\n"ok" untuk lanjut, atau /batal'
  )
}

async function handleBayarInvoiceWizard(
  supabase: ReturnType<typeof createClient>,
  token: string,
  chatId: number,
  text: string,
  user: Record<string, unknown>,
) {
  const step = user.wizard_step as number
  const data = (user.wizard_data ?? {}) as WizardData
  const list = data.invoice_list ?? []

  // Step 1: Pilih invoice dari daftar
  if (step === 1) {
    const n = text.trim()
    if (!/^\d+$/.test(n)) {
      await sendMessage(token, chatId, '⚠️ Kirim nomor invoice dari daftar, atau /batal.')
      return true
    }
    const idx = Number(n) - 1
    if (idx < 0 || idx >= list.length) {
      await sendMessage(token, chatId, `⚠️ Nomor tidak valid. Pilih 1-${list.length}, atau /batal.`)
      return true
    }
    const inv = list[idx]
    data.invoice_pick = idx
    await supabase
      .from('user_settings')
      .update({ wizard_step: 2, wizard_data: data, updated_at: new Date().toISOString() })
      .eq('user_id', user.user_id as string)
    const actions = inv.status_bayar === 'Lunas'
      ? '"hapus" — hapus invoice ini'
      : '"bayar" — catat pembayaran\n"batal bayar" — batalkan semua pembayaran\n"hapus" — hapus invoice ini'
    await sendMessage(
      token,
      chatId,
      `🧾 ${inv.nomor}\n${SEP}\n` +
      kv('🏢', 'Vendor', inv.vendor_nama) + '\n' +
      kv('📅', 'Tanggal', formatDate(inv.tanggal)) + '\n' +
      kv('💰', 'Total', fmtRupiah(inv.total)) + '\n' +
      kv('💳', 'Dibayar', fmtRupiah(inv.total - inv.sisa)) + '\n' +
      kv('💳', 'Sisa', fmtRupiah(inv.sisa)) + '\n' +
      kv('📊', 'Status', inv.status_bayar) + '\n' +
      `${SEP}\nBalas:\n${actions}`,
    )
    return true
  }

  // Step 2: Handle aksi
  if (step === 2) {
    const reply = text.trim().toLowerCase()
    const inv = list[data.invoice_pick ?? 0]
    if (!inv) {
      await clearWizard(supabase, user.user_id as string)
      await sendMessage(token, chatId, '⚠️ Data tidak ditemukan. Coba /cekinvoice lagi.')
      return true
    }

    if (reply === 'hapus') {
      await supabase
        .from('invoice')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', inv.id)
      await clearWizard(supabase, user.user_id as string)
      await sendMessage(token, chatId, `🗑️ Invoice ${inv.nomor} dihapus.`)
      return true
    }

    if (reply === 'batal bayar') {
      await supabase.rpc('reverse_invoice_payments', { p_invoice_id: inv.id })
      await clearWizard(supabase, user.user_id as string)
      await sendMessage(token, chatId, `↩️ Semua pembayaran ${inv.nomor} dibatalkan.\nStatus: Belum Bayar`)
      return true
    }

    if (reply === 'bayar') {
      if (inv.sisa <= 0) {
        await clearWizard(supabase, user.user_id as string)
        await sendMessage(token, chatId, `ℹ️ Invoice ${inv.nomor} sudah lunas.`)
        return true
      }
      data.mode = 'bayar_invoice'
      data.bayar_jumlah = undefined
      await supabase
        .from('user_settings')
        .update({ wizard_step: 3, wizard_data: data, updated_at: new Date().toISOString() })
        .eq('user_id', user.user_id as string)
      await sendMessage(
        token,
        chatId,
        `💳 BAYAR ${inv.nomor}\n${SEP}\n` +
        kv('💰', 'Sisa', fmtRupiah(inv.sisa)) + '\n\n' +
        'Kirim jumlah, atau "lunas" untuk full',
      )
      return true
    }

    await sendMessage(token, chatId, '⚠️ Pilih: "bayar", "batal bayar", atau "hapus".')
    return true
  }

  // Step 3: Jumlah bayar
  if (step === 3) {
    const reply = text.trim().toLowerCase()
    const inv = list[data.invoice_pick ?? 0]
    if (!inv) {
      await clearWizard(supabase, user.user_id as string)
      await sendMessage(token, chatId, '⚠️ Data tidak ditemukan. Coba /cekinvoice lagi.')
      return true
    }

    let jumlah = 0
    if (reply === 'lunas' || reply === 'full') {
      jumlah = inv.sisa
    } else {
      const cleaned = reply.replace(/[^\d]/g, '')
      if (!cleaned || Number(cleaned) <= 0) {
        await sendMessage(token, chatId, '⚠️ Kirim jumlah angka, atau "lunas" untuk full.')
        return true
      }
      jumlah = Number(cleaned)
      if (jumlah > inv.sisa) {
        await sendMessage(token, chatId, `⚠️ Jumlah melebihi sisa (${fmtRupiah(inv.sisa)}). Kirim ulang.`)
        return true
      }
    }
    data.bayar_jumlah = jumlah
    const today = new Date().toISOString().slice(0, 10)
    data.bayar_tanggal = today
    await supabase
      .from('user_settings')
      .update({ wizard_step: 4, wizard_data: data, updated_at: new Date().toISOString() })
      .eq('user_id', user.user_id as string)
    await sendMessage(
      token,
      chatId,
      `💳 KONFIRMASI BAYAR\n${SEP}\n` +
      kv('📋', 'Invoice', inv.nomor) + '\n' +
      kv('💰', 'Bayar', fmtRupiah(jumlah)) + '\n' +
      kv('📅', 'Tanggal', formatDate(today)) + '\n' +
      kv('💳', 'Sisa', fmtRupiah(inv.sisa - jumlah)) + '\n' +
      `${SEP}\nBalas "ya" untuk simpan, "batal" untuk batal`,
    )
    return true
  }

  // Step 4: Konfirmasi bayar
  if (step === 4) {
    const reply = text.toLowerCase()
    if (reply === 'batal' || reply === 'tidak' || reply === 'no') {
      await clearWizard(supabase, user.user_id as string)
      await sendMessage(token, chatId, '🚫 Dibatalkan.')
      return true
    }
    if (reply !== 'ya' && reply !== 'yes' && reply !== 'simpan') {
      await sendMessage(token, chatId, 'Balas "ya" untuk simpan, "batal" untuk batal.')
      return true
    }
    const inv = list[data.invoice_pick ?? 0]
    const jumlah = data.bayar_jumlah ?? 0
    const tanggal = data.bayar_tanggal ?? new Date().toISOString().slice(0, 10)
    if (!inv || jumlah <= 0) {
      await clearWizard(supabase, user.user_id as string)
      await sendMessage(token, chatId, '⚠️ Data tidak lengkap. Coba /cekinvoice lagi.')
      return true
    }
    const { error } = await supabase.rpc('record_invoice_payment', {
      p_invoice_id: inv.id,
      p_jumlah: jumlah,
      p_tanggal: tanggal,
      p_catatan: 'Pembayaran via bot Telegram',
    })
    await clearWizard(supabase, user.user_id as string)
    if (error) {
      await sendMessage(token, chatId, `⚠️ Gagal mencatat pembayaran: ${error.message}`)
    } else {
      const sisaBaru = inv.sisa - jumlah
      const status = sisaBaru <= 0 ? 'Lunas' : 'DP'
      await sendMessage(
        token,
        chatId,
        `✅ Pembayaran ${fmtRupiah(jumlah)} dicatat untuk ${inv.nomor}.\n💳 Sisa: ${fmtRupiah(sisaBaru)} — Status: ${status}`,
      )
    }
    return true
  }

  return false
}

async function clearWizard(supabase: ReturnType<typeof createClient>, userId: string) {
  await supabase
    .from('user_settings')
    .update({ wizard_step: null, wizard_data: null, updated_at: new Date().toISOString() })
    .eq('user_id', userId)
}

function parseStep(
  supabase: ReturnType<typeof createClient>,
  step: number,
  text: string,
  userId: string,
  data: WizardData,
): { ok: true; value: unknown } | { ok: false; error: string } {
  const fail = (error: string) => ({ ok: false as const, error })
  switch (step) {
    case 1: {
      const v = text.trim()
      if (v.length < 2) return fail('⚠️ Nama project terlalu pendek. Coba lagi.')
      return { ok: true, value: v }
    }
    case 2: {
      const n = text.trim()
      if (!/^\d+$/.test(n)) return fail('⚠️ Kirim nomor vendor dari daftar (angka).')
      const list = data.vendor_list ?? []
      const idx = Number(n) - 1
      if (idx < 0 || idx >= list.length) return fail('⚠️ Nomor vendor tidak ada di daftar. Coba lagi.')
      return { ok: true, value: list[idx].id }
    }
    case 3: {
      const n = text.trim()
      if (!/^\d+$/.test(n)) return fail('⚠️ Kirim nomor dari daftar.')
      const list = data.jenis_list ?? []
      const idx = Number(n) - 1
      if (idx < 0 || idx >= list.length) return fail(`⚠️ Nomor tidak valid. Pilih 1-${list.length}.`)
      return { ok: true, value: list[idx].jenis }
    }
    case 4: {
      const parsed = parseDateInput(text)
      if (parsed === undefined) {
        return fail('⚠️ Format salah. Contoh: 02082026 atau 15 Agu 2026.\nAtau kirim "-" jika tidak ada.')
      }
      return { ok: true, value: parsed }
    }
    case 5: {
      if (!/^[1234]$/.test(text.trim())) return fail('⚠️ Pilih 1, 2, 3, atau 4.')
      return { ok: true, value: STATUS_EDIT[Number(text) - 1] }
    }
    case 6: {
      if (!/^[12]$/.test(text.trim())) return fail('⚠️ Pilih 1 atau 2.')
      return { ok: true, value: STATUS_BAYAR[Number(text) - 1] }
    }
    case 7: {
      if (!/^[123]$/.test(text.trim())) return fail('⚠️ Pilih 1, 2, atau 3.')
      return { ok: true, value: STATUS_CETAK[Number(text) - 1] }
    }
    case 8: {
      const t = text.trim()
      return { ok: true, value: t === '-' ? null : t }
    }
  }
  return fail('⚠️ Terjadi kesalahan.')
}

async function getVendors(
  supabase: ReturnType<typeof createClient>,
  userId: string,
): Promise<{ id: string; nama: string }[] | null> {
  const { data } = await supabase
    .from('vendor')
    .select('id, nama')
    .eq('user_id', userId)
    .is('deleted_at', null)
    .order('nama')
  return data ?? null
}

// Daftar jenis edit diambil langsung dari "Daftar Produk / Harga" vendor
// (vendor_price_item), persis seperti di menu Vendor — bukan ditebak lewat kata kunci.
async function getVendorJenisList(
  supabase: ReturnType<typeof createClient>,
  vendorId: string,
): Promise<{ jenis: string; harga: number }[]> {
  const { data } = await supabase
    .from('vendor_price_item')
    .select('nama_produk, harga')
    .eq('vendor_id', vendorId)
    .order('urutan')
  const items = (data ?? []) as { nama_produk: string; harga: number }[]
  return items
    .map((p) => ({ jenis: p.nama_produk, harga: p.harga }))
    .filter((m) => m.harga > 0)
}

async function confirmText(
  supabase: ReturnType<typeof createClient>,
  data: WizardData,
): Promise<string> {
  const vendorLabel = data.vendor_id ? await getVendorName(supabase, data.vendor_id) : '-'
  return (
    `📝 KONFIRMASI JOB BARU\n${SEP}\n` +
    kv('📌', 'Nama', data.nama_project ?? '-') + '\n' +
    kv('🏢', 'Vendor', vendorLabel) + '\n' +
    kv('🎨', 'Jenis', data.jenis_edit ?? '-') + '\n' +
    kv('💰', 'Harga', fmtRupiah(data.harga ?? 0)) + '\n' +
    kv('📅', 'Deadline', formatDate(data.deadline)) + '\n' +
    kv('🔧', 'Status', data.status_edit ?? '-') + '\n' +
    kv('💳', 'Bayar', data.status_bayar ?? '-') + '\n' +
    kv('🖨️', 'Cetak', data.status_cetak ?? '-') + '\n' +
    kv('📝', 'Catatan', data.catatan ?? '-') + '\n' +
    `${SEP}\nBalas "ya" untuk menyimpan\natau "batal" untuk membatalkan`
  )
}

async function getVendorName(supabase: ReturnType<typeof createClient>, id: string): Promise<string> {
  const { data } = await supabase.from('vendor').select('nama').eq('id', id).maybeSingle()
  return data?.nama ?? '-'
}

type GroupBlock = {
  vendor: string
  subtotal: number
  items: string[]
}

function cmpVendorThenName(
  a: { vendor_nama?: string; nama_project?: string },
  b: { vendor_nama?: string; nama_project?: string },
): number {
  const va = (a.vendor_nama ?? '-').toLowerCase()
  const vb = (b.vendor_nama ?? '-').toLowerCase()
  if (va !== vb) return va < vb ? -1 : 1
  return (a.nama_project ?? '').toLowerCase().localeCompare((b.nama_project ?? '').toLowerCase())
}

function buildGroupedMessage(header: string, groups: GroupBlock[], footer?: string): string {
  const budget = 3800
  let lines: string[] = [header, SEP]
  let len = header.length + SEP.length + 2
  let summarized = false
  let no = 0
  const tail: string[] = []

  for (const g of groups) {
    if (!summarized) {
      const block = [`🏬 ${g.vendor.toUpperCase()} (${g.items.length})`]
      for (const it of g.items) {
        no++
        block.push(`   ${no}. ${it}`)
      }
      block.push(`   💰 Subtotal: ${fmtRupiah(g.subtotal)}`)
      const blockLen = block.reduce((s, l) => s + l.length + 1, 0)
      if (len + blockLen <= budget) {
        lines.push(...block, '')
        len += blockLen + 1
        continue
      }
      summarized = true
    }
    tail.push(`🏬 ${g.vendor} (+${g.items.length})`)
  }

  if (tail.length > 0) {
    lines.push(`📌 Ringkasan sisa (${tail.length} vendor):`, ...tail, '')
  }
  if (footer) lines.push(footer)
  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim()
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('ok')

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  const update = await req.json()
  const message = update.message
  if (!message?.text) return new Response('ok')

  const chatId = message.chat.id
  const text = String(message.text).trim()
  const token = await getSecret(supabase, 'telegram_bot_token')
  if (!token) return new Response('ok')

  // Perintah eksplisit
  const cmd = text.split(/\s+/)[0].toLowerCase()
  if (cmd === '/help' || cmd === '/start' && !/^\/start\s+\S+$/.test(text)) {
    await sendMessage(token, chatId, HELP_TEXT)
    return new Response('ok')
  }
  if (cmd === '/tambah') {
    const user = await getUserByChat(supabase, chatId)
    if (!user) {
      await sendMessage(token, chatId, NOT_CONNECTED_TEXT)
      return new Response('ok')
    }
    const vendors = await getVendors(supabase, user.user_id)
    if (!vendors || vendors.length === 0) {
      await sendMessage(token, chatId, '🚫 Belum ada vendor terdaftar. Tambahkan vendor dulu di web.')
      return new Response('ok')
    }
    const data: WizardData = { mode: 'tambah', vendor_list: vendors }
    await supabase
      .from('user_settings')
      .update({
        wizard_step: 1,
        wizard_data: data,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', user.user_id)
    await sendMessage(token, chatId, promptText(1, data))
    return new Response('ok')
  }
  if (cmd === '/batal') {
    const user = await getUserByChat(supabase, chatId)
    if (user?.wizard_step) {
      await clearWizard(supabase, user.user_id)
      await sendMessage(token, chatId, '🚫 Proses dibatalkan.')
    } else {
      await sendMessage(token, chatId, '🚫 Tidak ada proses yang berjalan.')
    }
    return new Response('ok')
  }
  if (cmd === '/buatinvoice') {
    const user = await getUserByChat(supabase, chatId)
    if (!user) {
      await sendMessage(token, chatId, NOT_CONNECTED_TEXT)
      return new Response('ok')
    }
    // Ambil vendor yang punya job belum bayar
    const { data: vendorRows } = await supabase
      .from('job')
      .select('vendor_id, vendor:vendor_id(nama)')
      .eq('user_id', user.user_id)
      .eq('status_bayar', 'Belum Bayar')
      .is('deleted_at', null)
    const vendorMap = new Map<string, { id: string; nama: string; job_count: number }>()
    for (const r of vendorRows ?? []) {
      const vid = r.vendor_id
      if (!vid) continue
      const existing = vendorMap.get(vid)
      if (existing) { existing.job_count++ } else {
        vendorMap.set(vid, { id: vid, nama: (r.vendor as { nama: string } | null)?.nama ?? '-', job_count: 1 })
      }
    }
    const vendorList = [...vendorMap.values()].sort((a, b) => a.nama.localeCompare(b.nama))
    if (vendorList.length === 0) {
      await sendMessage(token, chatId, '🎉 Tidak ada job yang belum bayar.\nGunakan /tambah untuk membuat job baru.')
      return new Response('ok')
    }
    const data: WizardData = { mode: 'buatinvoice', invoice_vendor_list: vendorList }
    await supabase
      .from('user_settings')
      .update({ wizard_step: 1, wizard_data: data, updated_at: new Date().toISOString() })
      .eq('user_id', user.user_id)
    const list = vendorList.map((v, i) => `${i + 1}) ${v.nama} (${v.job_count} job)`).join('\n')
    await sendMessage(token, chatId, `🧾 BUAT INVOICE (1/3)\n${SEP}\nPilih vendor:\n${list}`)
    return new Response('ok')
  }
  if (cmd === '/cekinvoice') {
    const user = await getUserByChat(supabase, chatId)
    if (!user) {
      await sendMessage(token, chatId, NOT_CONNECTED_TEXT)
      return new Response('ok')
    }
    const { data: invs, error } = await supabase
      .from('invoice')
      .select('id, nomor, vendor_nama, total, status_bayar, items_json, created_at')
      .eq('user_id', user.user_id)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(10)
    if (error) {
      await sendMessage(token, chatId, '⚠️ Terjadi kesalahan saat membaca data.')
      return new Response('ok')
    }
    if (!invs || invs.length === 0) {
      await sendMessage(token, chatId, '📭 Belum ada invoice.\nGunakan /buatinvoice untuk membuat invoice baru.')
      return new Response('ok')
    }
    const invList = invs.map((inv) => {
      let items: { harga?: number }[] = []
      try { items = JSON.parse(inv.items_json ?? '[]') } catch { items = [] }
      const totalInv = items.reduce((s, it) => s + (it.harga ?? 0), 0)
      return {
        id: inv.id,
        nomor: inv.nomor ?? '-',
        vendor_nama: inv.vendor_nama,
        total: inv.total ?? totalInv,
        sisa: inv.total ?? totalInv,
        status_bayar: inv.status_bayar ?? 'Belum Bayar',
        tanggal: inv.created_at?.slice(0, 10) ?? '',
      }
    })
    // Ambil total pembayaran untuk setiap invoice
    for (const inv of invList) {
      const { data: pays } = await supabase
        .from('invoice_payment')
        .select('jumlah')
        .eq('invoice_id', inv.id)
      const paid = (pays ?? []).reduce((s, p) => s + (p.jumlah ?? 0), 0)
      inv.sisa = Math.max(0, inv.total - paid)
    }
    await supabase
      .from('user_settings')
      .update({
        wizard_step: 1,
        wizard_data: { mode: 'bayar_invoice', invoice_list: invList },
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', user.user_id)
    const lines = invList.map((inv, i) => {
      const statusIcon = inv.status_bayar === 'Lunas' ? '✅' : inv.status_bayar === 'DP' ? '🟡' : '🔴'
      const sisaLine = inv.status_bayar !== 'Lunas' ? `\n           Sisa ${fmtRupiah(inv.sisa)}` : ''
      return `${i + 1}. ${inv.nomor}  ${inv.vendor_nama.padEnd(12)} ${statusIcon} ${inv.status_bayar}\n           Total ${fmtRupiah(inv.total)}${sisaLine}`
    }).join('\n')
    await sendMessage(
      token,
      chatId,
      `🧾 INVOICE (${invList.length})\n${SEP}\n${lines}\n${SEP}\nBalas nomor untuk kelola`,
    )
    return new Response('ok')
  }
  if (cmd === '/belumbayar' || cmd === '/deadline') {
    await handleQuery(supabase, token, chatId, cmd)
    return new Response('ok')
  }

  // Wizard aktif?
  if (await handleWizard(supabase, token, chatId, text)) return new Response('ok')

  // Kode connect (existing)
  const m = text.match(/^\/start(?:\s+([A-Za-z0-9]{6,}))?$/i)
  let code: string | null = null
  if (m) {
    code = m[1] ?? null
  } else if (/^[A-Za-z0-9]{6,}$/.test(text)) {
    code = text
  }

  if (!code) {
    await sendMessage(token, chatId, HELP_TEXT)
    return new Response('ok')
  }

  const now = new Date().toISOString()
  const { data: settings, error } = await supabase
    .from('user_settings')
    .select('*')
    .eq('telegram_connect_code', code)
    .gt('telegram_connect_expires', now)
    .is('telegram_chat_id', null)
    .maybeSingle()

  if (error || !settings) {
    await sendMessage(
      token,
      chatId,
      '⚠️ Kode tidak valid atau sudah kedaluwarsa.\nUlangi dari tombol "Hubungkan Telegram"\ndi aplikasi.',
    )
    return new Response('ok')
  }

  const { error: updErr } = await supabase
    .from('user_settings')
    .update({
      telegram_chat_id: String(chatId),
      telegram_connect_code: null,
      telegram_connect_expires: null,
    })
    .eq('user_id', settings.user_id)

  if (updErr) {
    await sendMessage(token, chatId, '⚠️ Gagal terhubung. Coba lagi nanti.')
    return new Response('ok')
  }

  const jam = settings.notif_jam?.slice(0, 5) ?? '07:00'
  await sendMessage(
    token,
    chatId,
    `🔗 TERHUBUNG\n${SEP}\n` +
      `Notifikasi deadline akan dikirim pukul\n${jam} WIB ke akun ini.\n\n` +
      HELP_TEXT,
  )
  return new Response('ok')
})

async function handleQuery(
  supabase: ReturnType<typeof createClient>,
  token: string,
  chatId: number,
  cmd: string,
) {
  const user = await getUserByChat(supabase, chatId)
  if (!user) {
    await sendMessage(token, chatId, NOT_CONNECTED_TEXT)
    return
  }

  if (cmd === '/belumbayar') {
    const { data: jobs, error } = await supabase
      .from('job')
      .select('nama_project, harga, vendor:vendor_id(nama)')
      .eq('user_id', user.user_id)
      .eq('status_bayar', 'Belum Bayar')
      .is('deleted_at', null)
      .order('created_at', { ascending: false })

    if (error) {
      await sendMessage(token, chatId, '⚠️ Terjadi kesalahan saat membaca data.')
      return
    }
    if (!jobs || jobs.length === 0) {
      await sendMessage(token, chatId, '🎉 Semua sudah lunas!')
      return
    }
    const flat = jobs.map((j) => ({
      nama_project: j.nama_project,
      harga: j.harga ?? 0,
      vendor_nama: j.vendor?.nama ?? '-',
    }))
    flat.sort(cmpVendorThenName)
    const groups: GroupBlock[] = []
    const byVendor = new Map<string, number>()
    for (const j of flat) {
      const key = j.vendor_nama
      let gi = byVendor.get(key)
      if (gi === undefined) {
        gi = groups.length
        byVendor.set(key, gi)
        groups.push({ vendor: key, subtotal: 0, items: [] })
      }
      const g = groups[gi]
      g.subtotal += j.harga
      g.items.push(`${j.nama_project} — ${fmtRupiah(j.harga)}`)
    }
    const grandTotal = groups.reduce((s, g) => s + g.subtotal, 0)
    await sendMessage(
      token,
      chatId,
      buildGroupedMessage(
        `🧾 BELUM BAYAR (${jobs.length})`,
        groups,
        `💰 TOTAL BELUM BAYAR\n   ${fmtRupiah(grandTotal)}`,
      ),
    )
    return
  }

  // /deadline
  const WIB = 7 * 60 * 60 * 1000
  const nowWIB = new Date(Date.now() + WIB)
  const today = nowWIB.getFullYear() + '-' +
    String(nowWIB.getMonth() + 1).padStart(2, '0') + '-' +
    String(nowWIB.getDate()).padStart(2, '0')
  const maxDate = addDays(today, 3)

  const { data: jobs, error } = await supabase
    .from('job')
    .select('nama_project, harga, deadline, vendor:vendor_id(nama)')
    .eq('user_id', user.user_id)
    .is('deleted_at', null)
    .not('deadline', 'is', null)
    .lte('deadline', maxDate)
    .not('status_edit', 'in', '("Selesai")')
    .order('deadline')

  if (error) {
    await sendMessage(token, chatId, '⚠️ Terjadi kesalahan saat membaca data.')
    return
  }
  if (!jobs || jobs.length === 0) {
    await sendMessage(token, chatId, '🎉 Tidak ada job mendekati deadline.')
    return
  }
  const flat = jobs.map((j) => ({
    nama_project: j.nama_project,
    harga: j.harga ?? 0,
    vendor_nama: j.vendor?.nama ?? '-',
    deadline: j.deadline,
  }))
  flat.sort(cmpVendorThenName)
  const groups: GroupBlock[] = []
  const byVendor = new Map<string, number>()
  for (const j of flat) {
    const key = j.vendor_nama
    let gi = byVendor.get(key)
    if (gi === undefined) {
      gi = groups.length
      byVendor.set(key, gi)
      groups.push({ vendor: key, subtotal: 0, items: [] })
    }
    const g = groups[gi]
    g.subtotal += j.harga
    const days = daysUntil(j.deadline ?? '')
    const label = days < 0 ? `Terlambat ${Math.abs(days)} hari` : days === 0 ? 'Hari ini' : days === 1 ? 'Besok' : `H-${days}`
    g.items.push(`${j.nama_project} — ${label}`)
  }
  const grandTotal = groups.reduce((s, g) => s + g.subtotal, 0)
  await sendMessage(
    token,
    chatId,
    buildGroupedMessage(
      `⏰ DEADLINE MENDEKAT (${jobs.length})`,
      groups,
      `💰 TOTAL • ${fmtRupiah(grandTotal)}`,
    ),
  )
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T00:00:00')
  d.setDate(d.getDate() + days)
  return d.getFullYear() + '-' +
    String(d.getMonth() + 1).padStart(2, '0') + '-' +
    String(d.getDate()).padStart(2, '0')
}

function daysUntil(dateStr: string): number {
  const WIB = 7 * 60 * 60 * 1000
  const now = new Date(Date.now() + WIB)
  now.setHours(0, 0, 0, 0)
  // dateStr+T00:00:00 di-parse sebagai UTC (= 07:00 WIB). Tambah offset WIB lalu
  // bulatkan ke tengah malam WIB supaya sebanding dengan `now`, agar selisih hari
  // tidak selalu kelebihan 7 jam (off-by-one).
  const target = new Date(new Date(dateStr + 'T00:00:00').getTime() + WIB)
  target.setHours(0, 0, 0, 0)
  return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
}
