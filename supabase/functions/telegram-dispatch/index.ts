import { createClient } from 'npm:@supabase/supabase-js@2'

const TELEGRAM_API = 'https://api.telegram.org'
const WIB_OFFSET_MS = 7 * 60 * 60 * 1000

async function getSecret(
  supabase: ReturnType<typeof createClient>,
  name: string,
): Promise<string | null> {
  const { data, error } = await supabase.rpc('siedit_get_secret', { p_name: name })
  if (error || !data) return null
  return data as string
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T00:00:00')
  d.setDate(d.getDate() + days)
  return d.getFullYear() + '-' +
    String(d.getMonth() + 1).padStart(2, '0') + '-' +
    String(d.getDate()).padStart(2, '0')
}

function nowWIB(): Date {
  return new Date(Date.now() + WIB_OFFSET_MS)
}

function todayWIBStr(): string {
  const d = nowWIB()
  return d.getFullYear() + '-' +
    String(d.getMonth() + 1).padStart(2, '0') + '-' +
    String(d.getDate()).padStart(2, '0')
}

function currentWIBTime(): string {
  const d = nowWIB()
  return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0')
}

function daysUntil(dateStr: string): number {
  const now = nowWIB()
  now.setHours(0, 0, 0, 0)
  // dateStr+T00:00:00 di-parse sebagai UTC (= 07:00 WIB). Tambah offset WIB lalu
  // bulatkan ke tengah malam supaya sebanding dengan `now`, agar selisih hari
  // tidak selalu kelebihan 7 jam (off-by-one).
  const target = new Date(new Date(dateStr + 'T00:00:00').getTime() + WIB_OFFSET_MS)
  target.setHours(0, 0, 0, 0)
  return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
}

function buildMessage(
  jobs: {
    nama_project: string
    jenis_edit: string
    deadline: string | null
    status_edit: string
    vendor?: { nama: string } | null
  }[],
): string {
  const groups: { header: string; items: string[] }[] = [
    { header: '⛔ TERLAMBAT', items: [] },
    { header: '🔴 HARI INI', items: [] },
    { header: '🟠 BESOK', items: [] },
    { header: '🟡 H-2', items: [] },
    { header: '🟢 H-3', items: [] },
  ]

  for (const j of jobs) {
    const days = daysUntil(j.deadline ?? '')
    const vendor = j.vendor?.nama ?? '-'
    const line = `${j.nama_project} — ${vendor}`
    if (days < 0) groups[0].items.push(line)
    else if (days === 0) groups[1].items.push(line)
    else if (days === 1) groups[2].items.push(line)
    else if (days === 2) groups[3].items.push(line)
    else groups[4].items.push(line)
  }

  const SEP = '——————————————'
  const lines: string[] = ['📅 DEADLINE MENDEKAT', SEP]
  for (const g of groups) {
    if (g.items.length === 0) continue
    lines.push(`${g.header} (${g.items.length})`)
    for (const it of g.items) lines.push(`• ${it}`)
    lines.push('')
  }
  return lines.join('\n').trim()
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('ok')

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  const secret = await getSecret(supabase, 'telegram_dispatch_secret')
  if (!secret || req.headers.get('x-internal-secret') !== secret) {
    return new Response('unauthorized', { status: 401 })
  }

  const token = await getSecret(supabase, 'telegram_bot_token')
  if (!token) return new Response('missing bot token', { status: 500 })

  const maxDate = addDays(todayWIBStr(), 3)
  const nowTime = currentWIBTime()

  const { data: settings, error: sErr } = await supabase
    .from('user_settings')
    .select('user_id, telegram_chat_id, notif_jam')
    .not('telegram_chat_id', 'is', null)

  if (sErr || !settings) return new Response('no settings', { status: 200 })

  const sent: string[] = []
  for (const s of settings) {
    const jam = (s.notif_jam ?? '07:00').slice(0, 5)
    if (jam !== nowTime) continue

    const { data: jobs, error: jErr } = await supabase
      .from('job')
      .select('nama_project, jenis_edit, deadline, status_edit, vendor:vendor_id(nama)')
      .eq('user_id', s.user_id)
      .is('deleted_at', null)
      .not('deadline', 'is', null)
      .lte('deadline', maxDate)
      .not('status_edit', 'in', '("Selesai")')
      .order('deadline')

    if (jErr) continue
    if (!jobs || jobs.length === 0) continue

    const text = buildMessage(jobs as never[])

    const res = await fetch(`${TELEGRAM_API}/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: s.telegram_chat_id,
        text,
        disable_web_page_preview: true,
      }),
    })
    if (res.ok) sent.push(s.telegram_chat_id!)
  }

  return new Response(JSON.stringify({ ok: true, sent }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
