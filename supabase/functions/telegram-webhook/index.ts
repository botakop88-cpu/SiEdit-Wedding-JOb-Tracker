import { createClient } from 'npm:@supabase/supabase-js@2'

const TELEGRAM_API = 'https://api.telegram.org'

const JENIS_EDIT = ['Kolase Sudah Pilih', 'Kolase Belum Pilih', 'Edit Full']
const STATUS_EDIT = ['Masuk', 'Sedang Edit', 'Revisi', 'Selesai']
const STATUS_BAYAR = ['Belum Bayar', 'Lunas']
const STATUS_CETAK = ['Belum Cetak', 'Sudah Dikirim', 'Sudah Cetak']

type WizardData = {
  nama_project?: string
  vendor_id?: string
  vendor_list?: { id: string; nama: string }[]
  jenis_edit?: string
  harga?: number
  deadline?: string | null
  status_edit?: string
  status_bayar?: string
  status_cetak?: string
  catatan?: string | null
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

const HELP_TEXT =
  'Perintah yang tersedia:\n\n' +
  '/tambah — Tambah job baru (wizard bertahap)\n' +
  '/belumbayar — Daftar job belum bayar\n' +
  '/lunas — Daftar job lunas\n' +
  '/deadline — Job mendekati/melewati deadline\n' +
  '/batal — Batalkan proses yang sedang berjalan\n' +
  '/help — Bantuan ini\n\n' +
  'Untuk connect: buka Pengaturan di web SiEdit, klik "Hubungkan Telegram", lalu kirim kode yang tampil.'

const wizardPrompts: { field: keyof WizardData; text: string }[] = [
  { field: 'nama_project', text: 'Nama project?' },
  { field: 'vendor_id', text: 'Pilih nomor vendor dari daftar:' },
  { field: 'jenis_edit', text: 'Jenis edit?\n1) Kolase Sudah Pilih\n2) Kolase Belum Pilih\n3) Edit Full' },
  { field: 'harga', text: 'Harga (Rp)? Kirim angka tanpa titik/koma.' },
  { field: 'deadline', text: 'Deadline? Format YYYY-MM-DD, atau kirim "-" jika tidak ada.' },
  { field: 'status_edit', text: 'Status edit?\n1) Masuk\n2) Sedang Edit\n3) Revisi\n4) Selesai' },
  { field: 'status_bayar', text: 'Status bayar?\n1) Belum Bayar\n2) Lunas' },
  { field: 'status_cetak', text: 'Status cetak?\n1) Belum Cetak\n2) Sudah Dikirim\n3) Sudah Cetak' },
  { field: 'catatan', text: 'Catatan? Kirim "-" jika tidak ada.' },
]

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
  const prompt = wizardPrompts[step - 1]

  // step 9 = catatan, step 10 = konfirmasi
  if (step <= 9) {
    const parsed = parseStep(supabase, step, text, user.user_id, data)
    if (!parsed.ok) {
      await sendMessage(token, chatId, parsed.error)
      return true
    }
    ;(data as Record<string, unknown>)[prompt.field] = parsed.value

    const nextStep = step + 1
    if (nextStep <= 9) {
      let nextText = wizardPrompts[nextStep - 1].text
      if (nextStep === 2) {
        const list = data.vendor_list ?? []
        if (list.length === 0) {
          await sendMessage(token, chatId, 'Belum ada vendor terdaftar. Tambahkan vendor dulu di web.')
          return true
        }
        nextText = list.map((v, i) => `${i + 1}) ${v.nama}`).join('\n')
      }
      if (nextStep === 4 && data.vendor_id && data.jenis_edit) {
        const sug = await suggestHarga(supabase, data.vendor_id, data.jenis_edit)
        if (sug !== null) nextText = `${nextText}\n\nSaran harga: ${sug}`
      }
      await supabase
        .from('user_settings')
        .update({ wizard_step: nextStep, wizard_data: data, updated_at: new Date().toISOString() })
        .eq('user_id', user.user_id)
      await sendMessage(token, chatId, nextText)
      return true
    }

    // nextStep = 10 → konfirmasi
    await supabase
      .from('user_settings')
      .update({ wizard_step: 10, wizard_data: data, updated_at: new Date().toISOString() })
      .eq('user_id', user.user_id)
    await sendMessage(token, chatId, await confirmText(supabase, data))
    return true
  }

  // step 10 = konfirmasi
  const reply = text.toLowerCase()
  if (reply === 'batal' || reply === 'tidak' || reply === 'no') {
    await clearWizard(supabase, user.user_id)
    await sendMessage(token, chatId, 'Dibatalkan.')
    return true
  }
  if (reply !== 'ya' && reply !== 'yes' && reply !== 'simpan') {
    await sendMessage(token, chatId, 'Balas "ya" untuk menyimpan, atau "batal" untuk membatalkan.')
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
    await sendMessage(token, chatId, `Gagal menyimpan job: ${error.message}`)
  } else {
    await sendMessage(token, chatId, `✅ Job "${data.nama_project}" berhasil ditambahkan!`)
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
      if (v.length < 2) return fail('Nama project terlalu pendek. Coba lagi.')
      return { ok: true, value: v }
    }
    case 2: {
      const n = text.trim()
      if (!/^\d+$/.test(n)) return fail('Kirim nomor vendor dari daftar (angka).')
      const list = data.vendor_list ?? []
      const idx = Number(n) - 1
      if (idx < 0 || idx >= list.length) return fail('Nomor vendor tidak ada di daftar. Coba lagi.')
      return { ok: true, value: list[idx].id }
    }
    case 3: {
      if (!/^[123]$/.test(text.trim())) return fail('Pilih 1, 2, atau 3.')
      return { ok: true, value: JENIS_EDIT[Number(text) - 1] }
    }
    case 4: {
      const v = text.replace(/[^\d]/g, '')
      if (!v) return fail('Harga harus angka.')
      return { ok: true, value: Number(v) }
    }
    case 5: {
      const t = text.trim()
      if (t === '-') return { ok: true, value: null }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) return fail('Format salah. Gunakan YYYY-MM-DD (contoh 2026-08-15) atau "-".')
      const d = new Date(t + 'T00:00:00')
      if (isNaN(d.getTime())) return fail('Tanggal tidak valid. Coba lagi.')
      return { ok: true, value: t }
    }
    case 6: {
      if (!/^[1234]$/.test(text.trim())) return fail('Pilih 1, 2, 3, atau 4.')
      return { ok: true, value: STATUS_EDIT[Number(text) - 1] }
    }
    case 7: {
      if (!/^[12]$/.test(text.trim())) return fail('Pilih 1 atau 2.')
      return { ok: true, value: STATUS_BAYAR[Number(text) - 1] }
    }
    case 8: {
      if (!/^[123]$/.test(text.trim())) return fail('Pilih 1, 2, atau 3.')
      return { ok: true, value: STATUS_CETAK[Number(text) - 1] }
    }
    case 9: {
      const t = text.trim()
      return { ok: true, value: t === '-' ? null : t }
    }
  }
  return fail('Terjadi kesalahan.')
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

async function suggestHarga(
  supabase: ReturnType<typeof createClient>,
  vendorId: string,
  jenis: string,
): Promise<string | null> {
  const { data } = await supabase
    .from('vendor')
    .select('harga_kolase_sudah_pilih, harga_kolase_belum_pilih, harga_edit_full')
    .eq('id', vendorId)
    .maybeSingle()
  if (!data) return null
  let harga: number
  if (jenis === 'Kolase Sudah Pilih') harga = data.harga_kolase_sudah_pilih
  else if (jenis === 'Kolase Belum Pilih') harga = data.harga_kolase_belum_pilih
  else harga = data.harga_edit_full
  if (!harga) return null
  return 'Rp' + harga.toLocaleString('id-ID')
}

async function confirmText(
  supabase: ReturnType<typeof createClient>,
  data: WizardData,
): Promise<string> {
  const vendorLabel = data.vendor_id ? await getVendorName(supabase, data.vendor_id) : '-'
  return (
    'Konfirmasi job baru:\n\n' +
    `📌 ${data.nama_project}\n` +
    `Vendor: ${vendorLabel}\n` +
    `Jenis: ${data.jenis_edit}\n` +
    `Harga: Rp${(data.harga ?? 0).toLocaleString('id-ID')}\n` +
    `Deadline: ${data.deadline ?? '-'}\n` +
    `Status edit: ${data.status_edit}\n` +
    `Status bayar: ${data.status_bayar}\n` +
    `Status cetak: ${data.status_cetak}\n` +
    `Catatan: ${data.catatan ?? '-'}\n\n` +
    'Balas "ya" untuk menyimpan, atau "batal" untuk membatalkan.'
  )
}

async function getVendorName(supabase: ReturnType<typeof createClient>, id: string): Promise<string> {
  const { data } = await supabase.from('vendor').select('nama').eq('id', id).maybeSingle()
  return data?.nama ?? '-'
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
      await sendMessage(
        token,
        chatId,
        'Kamu belum terhubung. Buka Pengaturan di web SiEdit, klik "Hubungkan Telegram", lalu kirim kode yang tampil.',
      )
      return new Response('ok')
    }
    const vendors = await getVendors(supabase, user.user_id)
    if (!vendors || vendors.length === 0) {
      await sendMessage(token, chatId, 'Belum ada vendor terdaftar. Tambahkan vendor dulu di web.')
      return new Response('ok')
    }
    await supabase
      .from('user_settings')
      .update({
        wizard_step: 1,
        wizard_data: { vendor_list: vendors },
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', user.user_id)
    await sendMessage(token, chatId, 'Tambah job baru.\n\nNama project?')
    return new Response('ok')
  }
  if (cmd === '/batal') {
    const user = await getUserByChat(supabase, chatId)
    if (user?.wizard_step) {
      await clearWizard(supabase, user.user_id)
      await sendMessage(token, chatId, 'Proses dibatalkan.')
    } else {
      await sendMessage(token, chatId, 'Tidak ada proses yang berjalan.')
    }
    return new Response('ok')
  }
  if (cmd === '/belumbayar' || cmd === '/lunas' || cmd === '/deadline') {
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
      'Kode tidak valid atau sudah kedaluwarsa. Ulangi dari tombol "Hubungkan Telegram" di aplikasi.',
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
    await sendMessage(token, chatId, 'Gagal terhubung. Coba lagi nanti.')
    return new Response('ok')
  }

  const jam = settings.notif_jam?.slice(0, 5) ?? '07:00'
  await sendMessage(
    token,
    chatId,
    `Terhubung! Notifikasi deadline akan dikirim pukul ${jam} WIB ke akun ini.\n\n${HELP_TEXT}`,
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
    await sendMessage(
      token,
      chatId,
      'Kamu belum terhubung. Buka Pengaturan di web SiEdit, klik "Hubungkan Telegram", lalu kirim kode yang tampil.',
    )
    return
  }

  if (cmd === '/belumbayar' || cmd === '/lunas') {
    const status = cmd === '/lunas' ? 'Lunas' : 'Belum Bayar'
    const { data: jobs, error } = await supabase
      .from('job')
      .select('nama_project, harga, vendor:vendor_id(nama)')
      .eq('user_id', user.user_id)
      .eq('status_bayar', status)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })

    if (error) {
      await sendMessage(token, chatId, 'Terjadi kesalahan saat membaca data.')
      return
    }
    if (!jobs || jobs.length === 0) {
      await sendMessage(
        token,
        chatId,
        cmd === '/lunas' ? 'Belum ada job yang lunas.' : 'Semua sudah lunas! 🎉',
      )
      return
    }
    const icon = cmd === '/lunas' ? '✅' : '💰'
    const lines = jobs.map(
      (j) => `${icon} ${j.nama_project} — ${j.vendor?.nama ?? '-'} — Rp${j.harga.toLocaleString('id-ID')}`,
    )
    await sendMessage(token, chatId, `${cmd === '/lunas' ? 'LUNAS' : 'BELUM BAYAR'} (${jobs.length})\n\n${lines.join('\n')}`)
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
    .select('nama_project, deadline, vendor:vendor_id(nama)')
    .eq('user_id', user.user_id)
    .is('deleted_at', null)
    .not('deadline', 'is', null)
    .lte('deadline', maxDate)
    .not('status_edit', 'in', '("Selesai")')
    .neq('status_bayar', 'Lunas')
    .order('deadline')

  if (error) {
    await sendMessage(token, chatId, 'Terjadi kesalahan saat membaca data.')
    return
  }
  if (!jobs || jobs.length === 0) {
    await sendMessage(token, chatId, 'Tidak ada job yang mendekati deadline. 🎉')
    return
  }
  const lines = jobs.map((j) => {
    const days = daysUntil(j.deadline ?? '')
    const label = days < 0 ? `Terlambat ${Math.abs(days)} hari` : days === 0 ? 'Hari ini' : days === 1 ? 'Besok' : `H-${days}`
    return `• ${j.nama_project} — ${j.vendor?.nama ?? '-'} — ${j.deadline} (${label})`
  })
  await sendMessage(token, chatId, `DEADLINE MENDEKAT (${jobs.length})\n\n${lines.join('\n')}`)
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
