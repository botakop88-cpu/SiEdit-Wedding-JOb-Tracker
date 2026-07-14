import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Briefcase, CreditCard, CalendarClock, Wallet, AlertTriangle, Clock } from 'lucide-react'
import { supabase } from '../lib/supabaseClient'
import type { Job } from '../lib/types'
import { rupiah, formatDate, daysUntil, timeAgo, todayStr } from '../lib/utils'

interface Stats {
  totalJob: number
  belumBayar: number
  deadlineHariIni: number
  pendapatanBulanIni: number
}

export default function Dashboard() {
  const [recentJobs, setRecentJobs] = useState<Job[]>([])
  const [deadlineJobs, setDeadlineJobs] = useState<Job[]>([])
  const [stats, setStats] = useState<Stats>({ totalJob: 0, belumBayar: 0, deadlineHariIni: 0, pendapatanBulanIni: 0 })
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    setLoading(true)

    const now = new Date()
    const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
    const today = todayStr()

    // Compute max deadline (today + 3 days)
    const d3 = new Date()
    d3.setDate(d3.getDate() + 3)
    const maxDeadline = d3.toISOString().slice(0, 10)

    const [
      totalRes,
      belumBayarRes,
      deadlineRes,
      pendapatanRes,
      activityRes,
      deadlineJobsRes,
    ] = await Promise.all([
      // 1. Total job count (head-only = no data, just count)
      supabase.from('job').select('*', { count: 'exact', head: true }).is('deleted_at', null),
      // 2. Belum bayar count (head-only)
      supabase.from('job').select('*', { count: 'exact', head: true }).is('deleted_at', null).eq('status_bayar', 'Belum Bayar'),
      // 3. Deadline hari ini count (head-only)
      supabase.from('job').select('*', { count: 'exact', head: true }).is('deleted_at', null).eq('deadline', today),
      // 4. Pendapatan bulan ini — only fetch harga column, no vendor join
      supabase.from('job').select('harga').is('deleted_at', null).eq('status_bayar', 'Lunas').gte('tanggal_lunas', monthStart),
      // 5. Recent 10 jobs for activity feed
      supabase.from('job').select('*, vendor:vendor_id(nama)').is('deleted_at', null).order('created_at', { ascending: false }).limit(10),
      // 6. Deadline within 3 days (exclude completed/paid jobs)
      supabase.from('job').select('*, vendor:vendor_id(nama)').is('deleted_at', null)
        .not('deadline', 'is', null)
        .gte('deadline', today)
        .lte('deadline', maxDeadline)
        .not('status_edit', 'in', '("Selesai","Sudah Dikirim")')
        .neq('status_bayar', 'Lunas')
        .order('deadline')
        .limit(10),
    ])

    setStats({
      totalJob: totalRes.count ?? 0,
      belumBayar: belumBayarRes.count ?? 0,
      deadlineHariIni: deadlineRes.count ?? 0,
      pendapatanBulanIni: (pendapatanRes.data ?? []).reduce((sum: number, j: { harga: number }) => sum + j.harga, 0),
    })

    if (activityRes.data) setRecentJobs(activityRes.data as Job[])
    if (deadlineJobsRes.data) setDeadlineJobs(deadlineJobsRes.data as Job[])
    setLoading(false)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-4 border-rose-500 border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Dashboard</h1>
        <p className="text-sm text-slate-500 mt-0.5">Ringkasan bisnis editing Anda</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <StatCard icon={Briefcase} label="Total Job" value={String(stats.totalJob)} color="bg-blue-500" />
        <StatCard icon={CreditCard} label="Belum Bayar" value={String(stats.belumBayar)} color="bg-amber-500" />
        <StatCard icon={CalendarClock} label="Deadline Hari Ini" value={String(stats.deadlineHariIni)} color="bg-red-500" />
        <StatCard icon={Wallet} label="Pendapatan Bulan Ini" value={rupiah(stats.pendapatanBulanIni)} color="bg-emerald-500" small />
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {/* Deadline terdekat */}
        <section className="bg-white rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-2 px-5 py-4 border-b border-slate-100">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            <h2 className="font-semibold text-slate-800 text-sm">Deadline Terdekat</h2>
          </div>
          {deadlineJobs.length === 0 ? (
            <p className="px-5 py-8 text-sm text-slate-400 text-center">Tidak ada deadline mendesak</p>
          ) : (
            <ul className="divide-y divide-slate-50">
              {deadlineJobs.map((j) => {
                const d = daysUntil(j.deadline!)
                const badge =
                  d === 0
                    ? 'bg-red-100 text-red-700'
                    : d === 1
                      ? 'bg-orange-100 text-orange-700'
                      : 'bg-green-100 text-green-700'
                const label = d === 0 ? 'Hari ini' : d === 1 ? 'Besok' : `${d} hari`
                return (
                  <li
                    key={j.id}
                    onClick={() => navigate('/jobs')}
                    className="flex items-center justify-between px-5 py-3 hover:bg-slate-50 cursor-pointer transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">{j.nama_project}</p>
                      <p className="text-xs text-slate-400">{j.vendor?.nama ?? '-'} · {formatDate(j.deadline)}</p>
                    </div>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full shrink-0 ml-3 ${badge}`}>{label}</span>
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        {/* Aktivitas terbaru */}
        <section className="bg-white rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-2 px-5 py-4 border-b border-slate-100">
            <Clock className="w-4 h-4 text-blue-500" />
            <h2 className="font-semibold text-slate-800 text-sm">Aktivitas Terbaru</h2>
          </div>
          {recentJobs.length === 0 ? (
            <p className="px-5 py-8 text-sm text-slate-400 text-center">Belum ada job</p>
          ) : (
            <ul className="divide-y divide-slate-50">
              {recentJobs.map((j) => (
                <li
                  key={j.id}
                  onClick={() => navigate('/jobs')}
                  className="flex items-center justify-between px-5 py-3 hover:bg-slate-50 cursor-pointer transition-colors"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">{j.nama_project}</p>
                    <p className="text-xs text-slate-400">{j.vendor?.nama ?? '-'} · {j.status_edit}</p>
                  </div>
                  <span className="text-xs text-slate-400 shrink-0 ml-3">{timeAgo(j.updated_at ?? j.created_at)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}

function StatCard({
  icon: Icon,
  label,
  value,
  color,
  small,
}: {
  icon: React.ElementType
  label: string
  value: string
  color: string
  small?: boolean
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex items-start gap-3">
      <div className={`${color} rounded-lg p-2.5 shrink-0`}>
        <Icon className="w-5 h-5 text-white" />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-slate-500 font-medium">{label}</p>
        <p className={`font-bold text-slate-800 mt-0.5 truncate ${small ? 'text-sm' : 'text-xl'}`}>{value}</p>
      </div>
    </div>
  )
}