import { useEffect, useState } from 'react'
import { Bell, MessageCircle, Settings, RefreshCw } from 'lucide-react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../lib/AuthContext'
import type { Job, UserSettings } from '../lib/types'
import { formatDate, daysUntil, buildWaLink, validateWhatsApp } from '../lib/utils'
import {
  useUrgentJobs,
  deadlineGroup,
  daysLabel,
  urgentGroupMeta,
  buildWaMessage,
} from '../lib/useUrgentJobs'

const GROUP_ORDER = ['overdue', 'hariIni', 'besok', 'h2', 'h3'] as const

export default function Notifications() {
  const { user } = useAuth()
  const { jobs, loading, count } = useUrgentJobs()
  const [settings, setSettings] = useState<UserSettings | null>(null)
  const [waNumber, setWaNumber] = useState('')
  const [waError, setWaError] = useState('')
  const [opening, setOpening] = useState<string | null>(null)

  useEffect(() => {
    loadSettings()
  }, [])

  async function loadSettings() {
    if (!user) return
    const { data } = await supabase
      .from('user_settings')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle()
    if (data) {
      setSettings(data as UserSettings)
      setWaNumber((data as UserSettings).notif_whatsapp ?? '')
    }
  }

  async function saveWa() {
    if (!user) return
    const digits = waNumber.replace(/\D/g, '')
    if (digits && !validateWhatsApp(waNumber)) {
      setWaError('Nomor WhatsApp tidak valid (min 10 digit).')
      return
    }
    setWaError('')
    const payload = { user_id: user.id, notif_whatsapp: digits || null, updated_at: new Date().toISOString() }
    const { error } = await supabase
      .from('user_settings')
      .upsert(payload, { onConflict: 'user_id' })
    if (error) {
      setWaError('Gagal menyimpan: ' + error.message)
      return
    }
    await loadSettings()
    setWaNumber(digits)
  }

  const groups = GROUP_ORDER.map((g) => ({
    group: g,
    meta: urgentGroupMeta(g),
    items: jobs
      .filter((j) => deadlineGroup(daysUntil(j.deadline ?? '')) === g)
      .sort((a, b) => (a.deadline ?? '').localeCompare(b.deadline ?? '')),
  })).filter((x) => x.items.length > 0)

  function openWa(j: Job) {
    if (!waNumber) {
      setWaError('Isi nomor WhatsApp di bawah dulu.')
      return
    }
    const days = daysUntil(j.deadline ?? '')
    setOpening(j.id)
    window.open(buildWaLink(waNumber, buildWaMessage(j, days)), '_blank', 'noopener')
    setTimeout(() => setOpening(null), 1000)
  }

  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <Bell className="w-6 h-6 text-rose-500" /> Notifikasi
        </h1>
        <p className="text-sm text-slate-500 mt-0.5">Job dengan deadline mendekat atau terlambat</p>
      </div>

      {/* Nomor WhatsApp */}
      <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-3">
        <div className="flex items-center gap-2">
          <MessageCircle className="w-4 h-4 text-emerald-500" />
          <h2 className="font-semibold text-sm text-slate-800">Nomor WhatsApp Tujuan</h2>
        </div>
        <p className="text-xs text-slate-400">
          Tombol WhatsApp pada job di bawah akan menghubungi nomor ini. Gunakan format 08xx atau 628xx.
        </p>
        <div className="flex gap-2">
          <input
            value={waNumber}
            onChange={(e) => setWaNumber(e.target.value)}
            placeholder="cth: 081234567890"
            className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
          />
          <button
            onClick={saveWa}
            className="px-4 py-2 rounded-lg bg-rose-600 text-white text-sm font-medium hover:bg-rose-700 transition-colors"
          >
            Simpan
          </button>
        </div>
        {waError && <p className="text-xs text-red-600">{waError}</p>}
        {settings?.notif_whatsapp && (
          <p className="text-xs text-emerald-600">Tersimpan: {settings.notif_whatsapp}</p>
        )}
      </section>

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <RefreshCw className="w-6 h-6 text-rose-500 animate-spin" />
        </div>
      ) : count === 0 ? (
        <div className="border border-slate-200 rounded-xl bg-white shadow-sm p-12 text-center">
          <Bell className="w-10 h-10 text-slate-200 mx-auto mb-3" />
          <p className="text-slate-500 text-sm">Tidak ada job mendesak. Semua aman.</p>
        </div>
      ) : (
        <div className="space-y-5">
          {groups.map(({ group, meta, items }) => (
            <section key={group} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className={`px-5 py-3 border-b border-slate-100 flex items-center justify-between ${meta.badge.split(' ')[0]}`}>
                <h2 className="font-semibold text-sm text-slate-800">{meta.label}</h2>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${meta.badge}`}>
                  {items.length}
                </span>
              </div>
              <ul className="divide-y divide-slate-50">
                {items.map((j) => {
                  const days = daysUntil(j.deadline ?? '')
                  const badge = urgentGroupMeta(deadlineGroup(days)).badge
                  return (
                    <li key={j.id} className="flex items-center justify-between gap-3 px-5 py-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-800 truncate">{j.nama_project}</p>
                        <p className="text-xs text-slate-400 truncate">
                          {j.vendor?.nama ?? '-'} · {j.jenis_edit} · {formatDate(j.deadline)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 ml-2">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${badge}`}>
                          {daysLabel(days)}
                        </span>
                        <button
                          onClick={() => openWa(j)}
                          disabled={opening === j.id}
                          className="flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-colors disabled:opacity-50"
                        >
                          <MessageCircle className="w-3.5 h-3.5" /> WA
                        </button>
                      </div>
                    </li>
                  )
                })}
              </ul>
            </section>
          ))}
        </div>
      )}

      <div className="text-center">
        <a href="/settings" className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-rose-600 transition-colors">
          <Settings className="w-3.5 h-3.5" /> Atur nomor di Pengaturan
        </a>
      </div>
    </div>
  )
}
