// ─── Rupiah formatting ──────────────────────────────────────────

export function rupiah(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

// ─── Date formatting ───────────────────────────────────────────

export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '-'
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function daysUntil(dateStr: string): number {
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const target = new Date(dateStr + 'T00:00:00')
  return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
}

export function timeAgo(dateStr: string): string {
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  const diff = now - then
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return 'Baru saja'
  if (minutes < 60) return `${minutes} menit yang lalu`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} jam yang lalu`
  const days = Math.floor(hours / 24)
  return `${days} hari yang lalu`
}

// ─── WhatsApp validation ────────────────────────────────────────

export function validateWhatsApp(value: string): boolean {
  const digits = value.replace(/\D/g, '')
  return digits.length >= 10 && digits.length <= 15
}

// Convert 08xx... or +628xx... to international 628xx... for wa.me links
export function normalizeWhatsApp(value: string): string {
  const digits = value.replace(/\D/g, '')
  if (digits.startsWith('0')) return '62' + digits.slice(1)
  if (digits.startsWith('628')) return digits
  if (digits.startsWith('62')) return digits
  return digits
}

export function buildWaLink(number: string, text: string): string {
  const no = normalizeWhatsApp(number)
  return `https://wa.me/${no}?text=${encodeURIComponent(text)}`
}

// ─── Today as YYYY-MM-DD ────────────────────────────────────────

export function todayStr(): string {
  const d = new Date()
  return d.getFullYear() + '-' +
    String(d.getMonth() + 1).padStart(2, '0') + '-' +
    String(d.getDate()).padStart(2, '0')
}