import { useEffect, useState } from 'react'
import { Bell, Settings, RefreshCw, Send } from 'lucide-react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../lib/AuthContext'
import type { UserSettings } from '../lib/types'
import { formatDate, daysUntil } from '../lib/utils'
import {
  useUrgentJobs,
  deadlineGroup,
  daysLabel,
  urgentGroupMeta,
} from '../lib/useUrgentJobs'

const GROUP_ORDER = ['overdue', 'hariIni', 'besok', 'h2', 'h3'] as const

export default function Notifications() {
  const { user } = useAuth()
  const { jobs, loading, count } = useUrgentJobs()
  const [settings, setSettings] = useState<UserSettings | null>(null)

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
    if (data) setSettings(data as UserSettings)
  }

  const groups = GROUP_ORDER.map((g) => ({
    group: g,
    meta: urgentGroupMeta(g),
    items: jobs
      .filter((j) => deadlineGroup(daysUntil(j.deadline ?? '')) === g)
      .sort((a, b) => (a.deadline ?? '').localeCompare(b.deadline ?? '')),
  })).filter((x) => x.items.length > 0)

  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <Bell className="w-6 h-6 text-rose-500" /> Notifikasi
        </h1>
        <p className="text-sm text-slate-500 mt-0.5">Job dengan deadline mendekat atau terlambat</p>
      </div>

      {/* Status Telegram */}
      <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-2">
        <div className="flex items-center gap-2">
          <Send className="w-4 h-4 text-sky-500" />
          <h2 className="font-semibold text-sm text-slate-800">Notifikasi Telegram</h2>
        </div>
        {settings?.telegram_chat_id ? (
          <p className="text-xs text-emerald-600">
            Terhubung. Rangkuman job di bawah dikirim otomatis pukul {settings.notif_jam?.slice(0, 5) ?? '07:00'} WIB.
          </p>
        ) : (
          <p className="text-xs text-slate-500">
            Belum terhubung. Hubungkan akun Telegram agar job mendesak dikirim otomatis ke Telegram.
          </p>
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
          <Settings className="w-3.5 h-3.5" /> Hubungkan Telegram di Pengaturan
        </a>
      </div>
    </div>
  )
}
