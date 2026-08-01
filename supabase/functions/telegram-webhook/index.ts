import { createClient } from 'npm:@supabase/supabase-js@2'

const TELEGRAM_API = 'https://api.telegram.org'

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

async function sendMessage(token: string, chatId: number, text: string) {
  await fetch(`${TELEGRAM_API}/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text }),
  })
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

  const m = text.match(/^\/start\s+([A-Za-z0-9]{6,})$/i)

  if (!m) {
    const token = await getSecret(supabase, 'telegram_bot_token')
    if (token) {
      await sendMessage(
        token,
        chatId,
        'Halo! Untuk terhubung ke notifikasi SiEdit, buka menu Pengaturan di aplikasi lalu klik tombol "Hubungkan Telegram".',
      )
    }
    return new Response('ok')
  }

  const code = m[1]
  const now = new Date().toISOString()

  const { data: settings, error } = await supabase
    .from('user_settings')
    .select('*')
    .eq('telegram_connect_code', code)
    .gt('telegram_connect_expires', now)
    .is('telegram_chat_id', null)
    .maybeSingle()

  const token = await getSecret(supabase, 'telegram_bot_token')

  if (error || !settings) {
    if (token) {
      await sendMessage(
        token,
        chatId,
        'Kode tidak valid atau sudah kedaluwarsa. Ulangi dari tombol "Hubungkan Telegram" di aplikasi.',
      )
    }
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
    if (token) await sendMessage(token, chatId, 'Gagal terhubung. Coba lagi nanti.')
    return new Response('ok')
  }

  const jam = settings.notif_jam?.slice(0, 5) ?? '07:00'
  if (token) {
    await sendMessage(
      token,
      chatId,
      `Terhubung! Notifikasi deadline akan dikirim pukul ${jam} WIB ke akun ini.`,
    )
  }
  return new Response('ok')
})
