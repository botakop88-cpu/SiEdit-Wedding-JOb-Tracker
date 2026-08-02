import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, ChevronRight, RefreshCw } from 'lucide-react'
import { useUrgentJobs, deadlineGroup, daysLabel, urgentGroupMeta } from '../lib/useUrgentJobs'
import { daysUntil, formatDate } from '../lib/utils'

const GROUP_ORDER = ['overdue', 'hariIni', 'besok', 'h2', 'h3'] as const

export default function NotificationBell() {
  const navigate = useNavigate()
  const { jobs, count, loading } = useUrgentJobs()
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onDocClick(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [open])

  const groups = GROUP_ORDER.map((g) => ({
    group: g,
    meta: urgentGroupMeta(g),
    items: jobs
      .filter((j) => deadlineGroup(daysUntil(j.deadline ?? '')) === g)
      .sort((a, b) => (a.deadline ?? '').localeCompare(b.deadline ?? '')),
  })).filter((x) => x.items.length > 0)

  return (
    <div className="relative" ref={rootRef}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Notifikasi"
        className="relative flex items-center justify-center w-10 h-10 rounded-full bg-white border border-slate-200 shadow-sm hover:border-rose-300 hover:shadow-md transition-all"
      >
        <Bell className="w-5 h-5 text-slate-600" />
        {!loading && count > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
            {count > 99 ? '99+' : count}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 z-50 w-[min(92vw,360px)] rounded-2xl bg-white border border-slate-200 shadow-xl shadow-slate-900/10 overflow-hidden">
          <div className="px-4 py-3 flex items-center justify-between border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-rose-500" />
              <p className="text-sm font-bold text-slate-900">Notifikasi</p>
            </div>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-rose-50 text-rose-600">
              {count} mendesak
            </span>
          </div>

          <div className="max-h-[70vh] overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-10">
                <RefreshCw className="w-5 h-5 text-rose-400 animate-spin" />
              </div>
            ) : count === 0 ? (
              <div className="py-10 text-center">
                <Bell className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-sm text-slate-500">Tidak ada job mendesak.</p>
                <p className="text-xs text-slate-400">Semua aman.</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {groups.map(({ group, meta, items }) => (
                  <div key={group} className="py-1.5">
                    <div className="px-4 pt-2 pb-1 flex items-center justify-between">
                      <p className="text-xs font-bold text-slate-900">{meta.label}</p>
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${meta.badge}`}>
                        {items.length}
                      </span>
                    </div>
                    <ul>
                      {items.map((j) => {
                        const days = daysUntil(j.deadline ?? '')
                        const badge = urgentGroupMeta(deadlineGroup(days)).badge
                        return (
                          <li key={j.id}>
                            <button
                              onClick={() => {
                                setOpen(false)
                                navigate('/jobs')
                              }}
                              className="w-full text-left px-4 py-2 flex items-center justify-between gap-2 hover:bg-slate-50 transition-colors"
                            >
                              <div className="min-w-0">
                                <p className="text-sm font-medium text-slate-900 truncate">{j.nama_project}</p>
                                <p className="text-xs text-slate-500 truncate">
                                  {j.vendor?.nama ?? '-'} · {j.jenis_edit} · {formatDate(j.deadline)}
                                </p>
                              </div>
                              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0 ${badge}`}>
                                {daysLabel(days)}
                              </span>
                            </button>
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={() => {
              setOpen(false)
              navigate('/notifications')
            }}
            className="w-full px-4 py-3 border-t border-slate-100 flex items-center justify-center gap-1 text-xs font-semibold text-rose-500 hover:bg-rose-50 transition-colors"
          >
            Lihat Semua Notifikasi
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  )
}
