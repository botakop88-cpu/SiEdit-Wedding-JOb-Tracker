import { createClient } from 'npm:@supabase/supabase-js@2'

const TELEGRAM_API = 'https://api.telegram.org'
const SEP = '━━━━━━━━━━━━━━━━'
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
  mode?: 'tambah' | 'lunas'
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
  lunas_list?: { id: string; nama_project: string; harga: number; vendor_nama: string }[]
  lunas_pick?: number
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
  '🔗 Kamu belum terhubung. Buka Pengaturan di\n' +
  'web SiEdit, klik "Hubungkan Telegram", lalu\n' +
  'kirim kode yang tampil.'

const HELP_TEXT =
  '📋 PERINTAH SiEdit BOT\n' +
  `${SEP}\n` +
  '/tambah — Tambah job baru\n' +
  '/belumbayar — Daftar job belum bayar\n' +
  '/lunas — Tandai job lunas\n' +
  '/deadline — Job mendekati deadline\n' +
  '/batal — Batalkan proses berjalan\n' +
  '/help — Bantuan ini\n' +
  `${SEP}\n` +
  '🔗 Hubungkan bot: buka Pengaturan di web\n' +
  'SiEdit, klik "Hubungkan Telegram", lalu\n' +
  'kirim kode yang tampil.'

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

  // Mode /lunas: tandai job lunas
  if (mode === 'lunas') {
    return handleLunasWizard(supabase, token, chatId, text, user)
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

  const payload = {
    user_id: user.user_id,
    vendor_id: data.vendor_id || null,
    nama_project: data.nama_project,
    jenis_edit: data.jenis_edit,
    harga: data.harga ?? 0,
    deadline: data.deadline || null,
    status_edit: data.status_edit,
    status_bayar: data.status_bayar,
    status_cetak: data.status_cetak,
    catatan: data.catatan || null,
    tanggal_lunas: data.status_bayar === 'Lunas' ? new Date().toISOString().slice(0, 10) : null,
    updated_at: new Date().toISOString(),
  }

  const { error } = await supabase.from('job').insert(payload)
  await clearWizard(supabase, user.user_id)
  if (error) {
    await sendMessage(token, chatId, `⚠️ Gagal menyimpan job: ${error.message}`)
  } else {
    await sendMessage(token, chatId, `✅ Job "${data.nama_project}" berhasil\nditambahkan!`)
  }
  return true
}

async function handleLunasWizard(
  supabase: ReturnType<typeof createClient>,
  token: string,
  chatId: number,
  text: string,
  user: Record<string, unknown>,
) {
  const step = user.wizard_step as number
  const data = (user.wizard_data ?? {}) as WizardData
  const list = data.lunas_list ?? []

  if (step === 1) {
    const n = text.trim()
    if (!/^\d+$/.test(n)) {
      await sendMessage(token, chatId, '⚠️ Kirim nomor dari daftar, atau /batal.')
      return true
    }
    const idx = Number(n) - 1
    if (idx < 0 || idx >= list.length) {
      await sendMessage(token, chatId, `⚠️ Nomor tidak valid. Pilih 1-${list.length}, atau /batal.`)
      return true
    }
    const pick = list[idx]
    data.lunas_pick = idx
    await supabase
      .from('user_settings')
      .update({ wizard_step: 2, wizard_data: data, updated_at: new Date().toISOString() })
      .eq('user_id', user.user_id as string)
    await sendMessage(
      token,
      chatId,
      `💳 KONFIRMASI LUNAS\n${SEP}\n` +
        `📌 ${pick.nama_project}\n` +
        `🏢 ${pick.vendor_nama}\n` +
        `💰 ${fmtRupiah(pick.harga)}\n\n` +
        'Balas "ya" untuk menandai LUNAS,\natau "batal".',
    )
    return true
  }

  // step 2 = konfirmasi
  const reply = text.toLowerCase()
  if (reply === 'batal' || reply === 'tidak' || reply === 'no') {
    await clearWizard(supabase, user.user_id as string)
    await sendMessage(token, chatId, '🚫 Dibatalkan.')
    return true
  }
  if (reply !== 'ya' && reply !== 'yes' && reply !== 'simpan') {
    await sendMessage(token, chatId, 'Balas "ya" untuk menandai LUNAS,\natau "batal".')
    return true
  }

  const pick = list[data.lunas_pick ?? 0]
  if (!pick) {
    await clearWizard(supabase, user.user_id as string)
    await sendMessage(token, chatId, '⚠️ Data tidak ditemukan. Coba /lunas lagi.')
    return true
  }

  const WIB = 7 * 60 * 60 * 1000
  const nowWIB = new Date(Date.now() + WIB)
  const today = nowWIB.getFullYear() + '-' +
    String(nowWIB.getMonth() + 1).padStart(2, '0') + '-' +
    String(nowWIB.getDate()).padStart(2, '0')

  const { error } = await supabase
    .from('job')
    .update({
      status_bayar: 'Lunas',
      tanggal_lunas: today,
      updated_at: new Date().toISOString(),
    })
    .eq('id', pick.id)
    .eq('user_id', user.user_id as string)

  await clearWizard(supabase, user.user_id as string)
  if (error) {
    await sendMessage(token, chatId, `⚠️ Gagal menandai lunas: ${error.message}`)
  } else {
    await sendMessage(token, chatId, `✅ "${pick.nama_project}" ditandai LUNAS\n(${formatDate(today)}).`)
  }
  return true
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

function classifyJenis(nama: string): string[] {
  const n = nama.toLowerCase()
  if (n.includes('belum') || n.includes('blom')) return ['Kolase Belum Pilih']
  if (n.includes('pilih') || n.includes('sudah')) return ['Kolase Sudah Pilih']
  if (n.includes('kolase')) return ['Kolase Sudah Pilih', 'Kolase Belum Pilih']
  if (n.includes('edit')) return ['Edit Full']
  return []
}

function autoFillHarga(
  items: { nama_produk: string; harga: number }[],
  hargaSp: number,
  hargaBp: number,
  hargaEf: number,
  jenis: string,
): number {
  if (items.length > 0) {
    const best = matchPriceItem(items, jenis)
    if (best) return best.harga
  }
  if (jenis === 'Kolase Sudah Pilih') return hargaSp
  if (jenis === 'Kolase Belum Pilih') return hargaBp
  return hargaEf
}

function matchPriceItem(
  items: { nama_produk: string; harga: number }[],
  jenis: string,
): { nama_produk: string; harga: number } | null {
  const q = (s: string) => s.toLowerCase()
  const isMatch = (p: { nama_produk: string; harga: number }): boolean => {
    const n = q(p.nama_produk)
    if (jenis === 'Kolase Sudah Pilih') {
      return (n.includes('pilih') || n.includes('sudah')) && !(n.includes('belum') || n.includes('blom'))
    }
    if (jenis === 'Kolase Belum Pilih') {
      return (n.includes('belum') || n.includes('blom')) && !n.includes('sudah')
    }
    return !n.includes('kolase') && (n.includes('full') || n.includes('edit'))
  }
  return items.find(isMatch) ?? null
}

async function getVendorJenisList(
  supabase: ReturnType<typeof createClient>,
  vendorId: string,
): Promise<{ jenis: string; harga: number }[]> {
  const [vRes, piRes] = await Promise.all([
    supabase
      .from('vendor')
      .select('harga_kolase_sudah_pilih, harga_kolase_belum_pilih, harga_edit_full')
      .eq('id', vendorId)
      .maybeSingle(),
    supabase
      .from('vendor_price_item')
      .select('nama_produk, harga')
      .eq('vendor_id', vendorId)
      .order('urutan'),
  ])
  const data = vRes.data
  if (!data) return []
  const items = (piRes.data ?? []) as { nama_produk: string; harga: number }[]
  const allJenis = ['Kolase Sudah Pilih', 'Kolase Belum Pilih', 'Edit Full']
  let jenisOptions: string[] = allJenis
  if (items.length > 0) {
    const available = Array.from(new Set(items.flatMap((p) => classifyJenis(p.nama_produk))))
    jenisOptions = available.length > 0 ? allJenis.filter((j) => available.includes(j)) : allJenis
  }
  return jenisOptions
    .map((jenis) => ({
      jenis,
      harga: autoFillHarga(items, data.harga_kolase_sudah_pilih, data.harga_kolase_belum_pilih, data.harga_edit_full, jenis),
    }))
    .filter((m) => m.harga && m.harga > 0)
}

async function confirmText(
  supabase: ReturnType<typeof createClient>,
  data: WizardData,
): Promise<string> {
  const vendorLabel = data.vendor_id ? await getVendorName(supabase, data.vendor_id) : '-'
  const row = (emoji: string, label: string, value: string) => `${emoji} ${label.padEnd(9)}: ${value}`
  return (
    `📝 KONFIRMASI JOB BARU\n${SEP}\n` +
    row('📌', 'Nama', data.nama_project ?? '-') + '\n' +
    row('🏢', 'Vendor', vendorLabel) + '\n' +
    row('🎨', 'Jenis', data.jenis_edit ?? '-') + '\n' +
    row('💰', 'Harga', fmtRupiah(data.harga ?? 0)) + '\n' +
    row('📅', 'Deadline', formatDate(data.deadline)) + '\n' +
    row('🔧', 'Status', data.status_edit ?? '-') + '\n' +
    row('💳', 'Bayar', data.status_bayar ?? '-') + '\n' +
    row('🖨️', 'Cetak', data.status_cetak ?? '-') + '\n' +
    row('📝', 'Catatan', data.catatan ?? '-') + '\n\n' +
    'Balas "ya" untuk menyimpan,\natau "batal" untuk membatalkan.'
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
  let lines: string[] = [header]
  let len = header.length + 1
  let summarized = false
  let no = 0
  const tail: string[] = []

  for (const g of groups) {
    if (!summarized) {
      const block = [SEP, `🏬 ${g.vendor} — ${g.items.length} job • ${fmtRupiah(g.subtotal)}`]
      for (const it of g.items) {
        no++
        block.push(`   ${no}. ${it}`)
      }
      const blockLen = block.reduce((s, l) => s + l.length + 1, 0)
      if (len + blockLen <= budget) {
        lines.push(...block)
        len += blockLen
        continue
      }
      summarized = true
    }
    tail.push(`🏬 ${g.vendor} (+${g.items.length})`)
  }

  if (tail.length > 0) {
    lines.push(SEP, `📌 Ringkasan sisa (${tail.length} vendor):`, ...tail)
  }
  if (footer) lines.push(SEP, footer)
  return lines.join('\n')
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
  if (cmd === '/lunas') {
    const user = await getUserByChat(supabase, chatId)
    if (!user) {
      await sendMessage(token, chatId, NOT_CONNECTED_TEXT)
      return new Response('ok')
    }
    const { data: jobs, error } = await supabase
      .from('job')
      .select('id, nama_project, harga, vendor:vendor_id(nama)')
      .eq('user_id', user.user_id)
      .neq('status_bayar', 'Lunas')
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(10)

    if (error) {
      await sendMessage(token, chatId, '⚠️ Terjadi kesalahan saat membaca data.')
      return new Response('ok')
    }
    if (!jobs || jobs.length === 0) {
      await sendMessage(token, chatId, '🎉 Semua sudah lunas!')
      return new Response('ok')
    }
    const lunasList = jobs
      .map((j) => ({
        id: j.id,
        nama_project: j.nama_project,
        harga: j.harga,
        vendor_nama: j.vendor?.nama ?? '-',
      }))
      .sort(cmpVendorThenName)
    const groups: GroupBlock[] = []
    const byVendor = new Map<string, number>()
    for (const j of lunasList) {
      const key = j.vendor_nama || '-'
      let gi = byVendor.get(key)
      if (gi === undefined) {
        gi = groups.length
        byVendor.set(key, gi)
        groups.push({ vendor: key, subtotal: 0, items: [] })
      }
      const g = groups[gi]
      g.subtotal += j.harga ?? 0
      g.items.push(`${j.nama_project} — ${fmtRupiah(j.harga)}`)
    }
    await supabase
      .from('user_settings')
      .update({
        wizard_step: 1,
        wizard_data: { mode: 'lunas', lunas_list: lunasList },
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', user.user_id)
    await sendMessage(
      token,
      chatId,
      buildGroupedMessage(`✅ PILIH JOB LUNAS (${lunasList.length})`, groups, 'Balas nomor di atas, atau /batal.'),
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
    .neq('status_bayar', 'Lunas')
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
    g.items.push(`${j.nama_project} — ${formatDate(j.deadline)} (${label})`)
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
  const target = new Date(dateStr + 'T00:00:00')
  return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
}
