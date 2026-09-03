import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Briefcase, CreditCard, CalendarClock, Wallet, Search, Download, CheckCircle2, Edit3, RefreshCw, Send, DollarSign, Inbox, Trophy, Medal } from 'lucide-react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../lib/AuthContext'
import type { Job } from '../lib/types'
import { rupiah, todayStr, timeAgo, formatDate } from '../lib/utils'

interface Stats {
  totalJob: number
  belumBayar: number
  deadlineHariIni: number
  pendapatanBulanIni: number
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']

const ACTIVITY_META: Record<string, { icon: typeof Inbox; bg: string; fg: string }> = {
  Masuk: { icon: Inbox, bg: 'bg-blue-50', fg: 'text-blue-500' },
  'Sedang Edit': { icon: Edit3, bg: 'bg-orange-50', fg: 'text-orange-500' },
  Revisi: { icon: RefreshCw, bg: 'bg-purple-50', fg: 'text-purple-500' },
  Selesai: { icon: Send, bg: 'bg-emerald-50', fg: 'text-emerald-500' },
}

function activityMeta(status: string) {
  return ACTIVITY_META[status] ?? { icon: Briefcase, bg: 'bg-slate-100', fg: 'text-slate-500' }
}

function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

export default function Dashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [deadlineJobs, setDeadlineJobs] = useState<Job[]>([])
  const [recentJobs, setRecentJobs] = useState<Job[]>([])
  const [stats, setStats] = useState<Stats>({ totalJob: 0, belumBayar: 0, deadlineHariIni: 0, pendapatanBulanIni: 0 })
  const [pendapatanBulanLalu, setPendapatanBulanLalu] = useState(0)
  const [piutang, setPiutang] = useState(0)
  const [summary, setSummary] = useState({ masuk: 0, sedangEdit: 0, revisi: 0, siapKirim: 0, vendorBayar: 0 })
  const [progress, setProgress] = useState({ target: 0, selesai: 0, sisa: 0 })
  const [barData, setBarData] = useState<{ label: string; total: number }[]>([])
  const [lineData, setLineData] = useState<{ label: string; masuk: number; selesai: number }[]>([])
  const [statusCounts, setStatusCounts] = useState({ masuk: 0, sedangEdit: 0, revisi: 0, selesai: 0 })
  const [topVendors, setTopVendors] = useState<{ nama: string; jobs: number }[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (user) loadData()
  }, [user?.id])

  async function loadData() {
    setLoading(true)
    try {
    const now = new Date()
    const today = todayStr()
    const start = new Date(now.getFullYear(), now.getMonth() - 5, 1)
    const startStr = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-01`
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)

    const d3 = new Date()
    d3.setDate(d3.getDate() + 3)
    const maxDeadline = `${d3.getFullYear()}-${String(d3.getMonth() + 1).padStart(2, '0')}-${String(d3.getDate()).padStart(2, '0')}`

    const [totalRes, belumBayarRes, deadlineRes, chartRes, deadlineJobsRes, recentRes, statusRes, lineRes, vendorRes, piutangRes] = await Promise.all([
      supabase.from('job').select('*', { count: 'exact', head: true }).is('deleted_at', null),
      supabase.from('job').select('*', { count: 'exact', head: true }).is('deleted_at', null).neq('status_bayar', 'Lunas'),
      supabase.from('job').select('*', { count: 'exact', head: true }).is('deleted_at', null).not('deadline', 'is', null).lte('deadline', today)
        .not('status_edit', 'in', '("Selesai")'),
      // Basis grafik pendapatan: job_payment (mencakup DP/cicilan), bukan cuma job Lunas
      // penuh — supaya DP yang diterima bulan ini ikut terhitung sebagai pendapatan
      // bulan ini walau job-nya baru lunas penuh di bulan lain (atau belum lunas sama sekali).
      supabase.from('job_payment').select('jumlah, tanggal').gte('tanggal', startStr),
      supabase.from('job').select('*, vendor:vendor_id(nama)').is('deleted_at', null)
        .not('deadline', 'is', null).lte('deadline', maxDeadline)
        .not('status_edit', 'in', '("Selesai")').order('deadline').limit(10),
      supabase.from('job').select('*, vendor:vendor_id(nama)').is('deleted_at', null).order('created_at', { ascending: false }).limit(5),
      supabase.from('job').select('status_edit').is('deleted_at', null),
      supabase.from('job').select('created_at, status_edit, tanggal_lunas').is('deleted_at', null),
      supabase.from('job').select('*, vendor:vendor_id(nama)').is('deleted_at', null),
      supabase.from('job').select('harga, total_dibayar').is('deleted_at', null).neq('status_bayar', 'Lunas'),
    ])

    const chartRows = (chartRes.data ?? []) as { jumlah: number; tanggal: string }[]
    const thisMonthKey = monthKey(now)
    const lastMonthKey = monthKey(lastMonthStart)
    let pendapatanIni = 0
    let pendapatanLalu = 0
    const buckets = new Map<string, number>()
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      buckets.set(monthKey(d), 0)
    }
    for (const row of chartRows) {
      const k = row.tanggal.slice(0, 7)
      if (buckets.has(k)) buckets.set(k, (buckets.get(k) ?? 0) + row.jumlah)
      if (k === thisMonthKey) pendapatanIni += row.jumlah
      if (k === lastMonthKey) pendapatanLalu += row.jumlah
    }

    setBarData(Array.from(buckets.entries()).map(([k, v]) => {
      const m = Number(k.split('-')[1])
      return { label: MONTHS[m - 1], total: v }
    }))

    const lineRows = (lineRes.data ?? []) as { created_at: string | null; status_edit: string; tanggal_lunas: string | null }[]
    const masukBuckets = new Map<string, number>()
    const selesaiBuckets = new Map<string, number>()
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      masukBuckets.set(monthKey(d), 0)
      selesaiBuckets.set(monthKey(d), 0)
    }
    for (const row of lineRows) {
      if (row.created_at) {
        const k = row.created_at.slice(0, 7)
        if (masukBuckets.has(k)) masukBuckets.set(k, (masukBuckets.get(k) ?? 0) + 1)
      }
      const doneKey = row.tanggal_lunas ?? null
      if (doneKey) {
        const k = doneKey.slice(0, 7)
        if (selesaiBuckets.has(k)) selesaiBuckets.set(k, (selesaiBuckets.get(k) ?? 0) + 1)
      }
    }
    setLineData(Array.from(masukBuckets.keys()).map((k) => {
      const m = Number(k.split('-')[1])
      return { label: MONTHS[m - 1], masuk: masukBuckets.get(k) ?? 0, selesai: selesaiBuckets.get(k) ?? 0 }
    }))

    const statusData = (statusRes.data ?? []) as { status_edit: string }[]
    const counts = { masuk: 0, sedangEdit: 0, revisi: 0, selesai: 0 }
    for (const s of statusData) {
      if (s.status_edit === 'Masuk') counts.masuk++
      else if (s.status_edit === 'Sedang Edit') counts.sedangEdit++
      else if (s.status_edit === 'Revisi') counts.revisi++
      else if (s.status_edit === 'Selesai') counts.selesai++
    }
    setStatusCounts(counts)

    const piutangRows = (piutangRes.data ?? []) as { harga: number; total_dibayar: number }[]
    setPiutang(piutangRows.reduce((sum, r) => sum + Math.max(0, (r.harga || 0) - (r.total_dibayar || 0)), 0))

    const allRows = (lineRes.data ?? []) as { created_at: string | null; status_edit: string; tanggal_lunas: string | null }[]
    const summary = { masuk: 0, sedangEdit: 0, revisi: 0, siapKirim: 0, vendorBayar: 0 }
    for (const row of allRows) {
      if (row.created_at?.startsWith(today)) summary.masuk++
      if (row.tanggal_lunas?.startsWith(today)) summary.vendorBayar++
      if (row.status_edit === 'Sedang Edit') summary.sedangEdit++
      else if (row.status_edit === 'Revisi') summary.revisi++
      else if (row.status_edit === 'Selesai') summary.siapKirim++
    }
    setSummary(summary)

    const thisMonthCount = allRows.filter((r) => r.created_at?.startsWith(thisMonthKey)).length
    const selesaiThisMonth = allRows.filter((r) => r.tanggal_lunas?.startsWith(thisMonthKey)).length
    setProgress({ target: thisMonthCount, selesai: selesaiThisMonth, sisa: Math.max(thisMonthCount - selesaiThisMonth, 0) })

    setStats({
      totalJob: totalRes.count ?? 0,
      belumBayar: belumBayarRes.count ?? 0,
      deadlineHariIni: deadlineRes.count ?? 0,
      pendapatanBulanIni: pendapatanIni,
    })
    setPendapatanBulanLalu(pendapatanLalu)

    if (deadlineJobsRes.data) setDeadlineJobs(deadlineJobsRes.data as Job[])
    if (recentRes.data) setRecentJobs(recentRes.data as Job[])

    const vendorRows = (vendorRes.data ?? []) as { vendor: { nama: string } | null }[]
    const vendorCount = new Map<string, number>()
    for (const row of vendorRows) {
      const nama = row.vendor?.nama ?? 'Tanpa Vendor'
      vendorCount.set(nama, (vendorCount.get(nama) ?? 0) + 1)
    }
    setTopVendors(
      Array.from(vendorCount.entries())
        .map(([nama, jobs]) => ({ nama, jobs }))
        .sort((a, b) => b.jobs - a.jobs)
        .slice(0, 3)
    )
    } catch {
      // error handled silently — data stays stale
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-4 border-rose-500 border-t-transparent" />
      </div>
    )
  }

  const firstName = user?.user_metadata?.full_name ?? user?.user_metadata?.name ?? ((user?.email ?? '').split('@')[0] || 'Pengguna')
  const delta = pendapatanBulanLalu > 0 ? ((stats.pendapatanBulanIni - pendapatanBulanLalu) / pendapatanBulanLalu) * 100 : stats.pendapatanBulanIni > 0 ? 100 : 0

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-4">
      {/* Header: Greeting + Search */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">{(() => { const h = new Date().getHours(); if (h < 11) return 'Selamat Pagi'; if (h < 15) return 'Selamat Siang'; if (h < 18) return 'Selamat Sore'; return 'Selamat Malam'; })()}, {firstName}! 👋</h1>
          <p className="text-sm text-slate-500 mt-1">Semangat! Kamu punya {stats.deadlineHariIni} deadline hari ini.</p>
        </div>
        <div className="hidden md:flex items-center gap-3">
          <form
            onSubmit={(e) => {
              e.preventDefault()
              navigate(`/jobs${searchQuery ? `?q=${encodeURIComponent(searchQuery)}` : ''}`)
            }}
            className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-4 py-2.5 w-80"
          >
            <Search className="w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari job, vendor, invoice..."
              className="flex-1 text-sm bg-transparent outline-none text-slate-900 placeholder:text-slate-400"
            />
          </form>
        </div>
      </div>

      {/* 4 KPI Cards - LARGE */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-4">
          <div className="flex items-start gap-4">
            <div className="w-11 h-11 rounded-full bg-rose-50 flex items-center justify-center shrink-0">
              <Briefcase className="w-5 h-5 text-rose-500" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-slate-500 font-medium mb-1">Total Job</p>
              <p className="text-2xl font-bold text-slate-900">{stats.totalJob}</p>
              <p className="text-xs text-emerald-600 mt-1 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> {stats.totalJob - stats.belumBayar} Lunas
              </p>
            </div>
          </div>
        </div>

        <div className="card p-4">
          <div className="flex items-start gap-4">
            <div className="w-11 h-11 rounded-full bg-orange-50 flex items-center justify-center shrink-0">
              <CreditCard className="w-5 h-5 text-orange-500" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-slate-500 font-medium mb-1">Belum Lunas</p>
              <p className="text-2xl font-bold text-slate-900">{stats.belumBayar}</p>
              <p className="text-xs text-orange-600 mt-1">Total {rupiah(piutang)}</p>
            </div>
          </div>
        </div>

        <div className="card p-4">
          <div className="flex items-start gap-4">
            <div className="w-11 h-11 rounded-full bg-rose-50 flex items-center justify-center shrink-0">
              <CalendarClock className="w-5 h-5 text-rose-500" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-slate-500 font-medium mb-1">Deadline Hari Ini</p>
              <p className="text-2xl font-bold text-slate-900">{stats.deadlineHariIni}</p>
              <button onClick={() => navigate('/jobs')} className="text-xs text-rose-600 hover:text-rose-700 mt-1 font-medium flex items-center gap-1">
                Lihat detail →
              </button>
            </div>
          </div>
        </div>

        <div className="card p-4">
          <div className="flex items-start gap-4">
            <div className="w-11 h-11 rounded-full bg-emerald-50 flex items-center justify-center shrink-0">
              <Wallet className="w-5 h-5 text-emerald-500" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-slate-500 font-medium mb-1">Pendapatan Bulan Ini</p>
              <p className="text-xl font-bold text-slate-900">{rupiah(stats.pendapatanBulanIni)}</p>
              <p className="text-xs text-emerald-600 mt-1 flex items-center gap-1">
                ↑ {Math.abs(delta).toFixed(0)}% dari bulan lalu
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 3-Column: Deadline + Ringkasan + Progress */}
      <div className="grid lg:grid-cols-3 gap-4">
        {/* Deadline Hari Ini */}
        <section className="card p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-slate-900">Deadline Hari Ini</h2>
            <button onClick={() => navigate('/jobs')} className="text-sm text-rose-500 hover:text-rose-600 font-medium">
              Lihat Semua
            </button>
          </div>
          {deadlineJobs.length === 0 ? (
            <p className="text-sm text-slate-400 py-8 text-center">Tidak ada deadline 🎉</p>
          ) : (
            <div className="space-y-1">
              {deadlineJobs.map((j, idx) => (
                <div key={j.id} className="flex items-start gap-3">
                  <div className="flex flex-col items-center shrink-0 w-16">
                    <span className="text-[10px] font-bold text-slate-900 leading-tight text-center">{formatDate(j.deadline)}</span>
                    <div className="w-2 h-2 rounded-full bg-rose-500 mt-1" />
                    {idx < deadlineJobs.length - 1 && <div className="w-0.5 h-14 bg-slate-200 mt-1" />}
                  </div>
                  <div className="flex-1 min-w-0 pt-1">
                    <p className="font-semibold text-slate-900 text-sm">{j.nama_project}</p>
                    <p className="text-xs text-slate-500">Pernikahan {j.vendor?.nama ?? '-'}</p>
                    <span className="inline-block mt-1.5 px-2 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-700">
                      {j.jenis_edit}
                    </span>
                  </div>
                  <button className="text-slate-400 hover:text-slate-600 shrink-0">→</button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Ringkasan Hari Ini */}
        <section className="card p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-slate-900">Ringkasan Hari Ini</h2>
            <select className="text-xs border border-slate-200 rounded-lg px-2 py-1 bg-white text-slate-600">
              <option>Hari Ini</option>
            </select>
          </div>
          <div className="space-y-3">
            <RingkasanItem icon={<Download className="w-5 h-5" />} label="Job Masuk" value={String(summary.masuk)} chipClass="bg-blue-50 text-blue-500" />
            <RingkasanItem icon={<Edit3 className="w-5 h-5" />} label="Sedang Diedit" value={String(summary.sedangEdit)} chipClass="bg-orange-50 text-orange-500" />
            <RingkasanItem icon={<RefreshCw className="w-5 h-5" />} label="Revisi" value={String(summary.revisi)} chipClass="bg-purple-50 text-purple-500" />
            <RingkasanItem icon={<Send className="w-5 h-5" />} label="Siap Dikirim" value={String(summary.siapKirim)} chipClass="bg-emerald-50 text-emerald-500" />
            <RingkasanItem icon={<DollarSign className="w-5 h-5" />} label="Vendor Bayar" value={String(summary.vendorBayar)} chipClass="bg-amber-50 text-amber-500" />
          </div>
        </section>

        {/* Progress Bulan Ini */}
        <section className="card p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-slate-900">Progress Bulan Ini</h2>
            <button onClick={() => navigate('/reports')} className="text-sm text-rose-500 hover:text-rose-600 font-medium">Detail</button>
          </div>
          {(() => {
            const pct = progress.target > 0 ? Math.round((progress.selesai / progress.target) * 100) : 0
            return (
              <>
                <div className="flex items-center justify-center mb-6">
                  <div className="relative w-36 h-36">
                    <svg className="w-36 h-36 transform -rotate-90">
                      <circle cx="72" cy="72" r="60" fill="none" stroke="#e2e8f0" strokeWidth="12" />
                      <circle
                        cx="72"
                        cy="72"
                        r="60"
                        fill="none"
                        stroke="#3b82f6"
                        strokeWidth="12"
                        strokeDasharray={`${60 * 2 * Math.PI * (pct / 100)} ${60 * 2 * Math.PI}`}
                        strokeLinecap="round"
                      />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-2xl font-bold text-slate-900">{pct}%</span>
                      <span className="text-xs text-slate-500">Selesai</span>
                    </div>
                  </div>
                </div>
                <div className="space-y-2.5 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-600">Job Masuk Bulan Ini</span>
                    <span className="font-bold text-slate-900">{progress.target} Job</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-blue-600">Selesai</span>
                    <span className="font-bold text-slate-900">{progress.selesai} Job</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-rose-600">Sisa</span>
                    <span className="font-bold text-slate-900">{progress.sisa} Job</span>
                  </div>
                </div>
                <div className="mt-4 flex items-center gap-2 text-xs text-emerald-600 bg-emerald-50 rounded-lg px-3 py-2">
                  <CheckCircle2 className="w-4 h-4" />
                  <span className="font-medium">Penyelesaian {pct}%</span>
                </div>
                <p className="text-xs text-slate-500 mt-2">Pertahankan semangatmu!</p>
              </>
            )
          })()}
        </section>
      </div>

      {/* Status Job + Aktivitas + Vendor */}
      <div className="grid lg:grid-cols-3 gap-4">
        {/* Status Job */}
        <section className="card p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-slate-900">Status Job</h2>
            <button onClick={() => navigate('/jobs')} className="text-sm text-rose-500 hover:text-rose-600 font-medium">Lihat Semua</button>
          </div>
          <div className="space-y-4">
            <StatusBar label="Masuk" value={statusCounts.masuk} max={stats.totalJob} color="bg-blue-500" chipClass="bg-blue-50 text-blue-500" icon={<Inbox className="w-5 h-5" />} />
            <StatusBar label="Sedang Edit" value={statusCounts.sedangEdit} max={stats.totalJob} color="bg-orange-500" chipClass="bg-orange-50 text-orange-500" icon={<Edit3 className="w-5 h-5" />} />
            <StatusBar label="Revisi" value={statusCounts.revisi} max={stats.totalJob} color="bg-purple-500" chipClass="bg-purple-50 text-purple-500" icon={<RefreshCw className="w-5 h-5" />} />
            <StatusBar label="Selesai & Dikirim" value={statusCounts.selesai} max={stats.totalJob} color="bg-emerald-500" chipClass="bg-emerald-50 text-emerald-500" icon={<Send className="w-5 h-5" />} />
          </div>
        </section>

        {/* Aktivitas Terbaru */}
        <section className="card p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-slate-900">Aktivitas Terbaru</h2>
            <button onClick={() => navigate('/jobs')} className="text-sm text-rose-500 hover:text-rose-600 font-medium">Lihat Semua</button>
          </div>
          <div className="space-y-3">
            {recentJobs.slice(0, 5).map((j) => {
              const meta = activityMeta(j.status_edit)
              const Icon = meta.icon
              return (
                <div key={j.id} className="flex items-start gap-3">
                  <div className={`w-11 h-11 rounded-full ${meta.bg} flex items-center justify-center shrink-0`}>
                    <Icon className={`w-5 h-5 ${meta.fg}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-900 truncate">{j.nama_project}</p>
                    <p className="text-xs text-slate-500 truncate">{j.jenis_edit} · {j.vendor?.nama ?? '-'}</p>
                  </div>
                  <span className="text-xs text-slate-400 shrink-0">{timeAgo(j.created_at)}</span>
                </div>
              )
            })}
          </div>
        </section>

        {/* Vendor Paling Aktif */}
        <section className="card p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-slate-900">Vendor Paling Aktif</h2>
            <select className="text-xs border border-slate-200 rounded-lg px-2 py-1 bg-white text-slate-600">
              <option>Bulan Ini</option>
            </select>
          </div>
          <div className="space-y-3">
            {topVendors.length === 0 ? (
              <p className="text-sm text-slate-400 py-2">Belum ada data vendor.</p>
            ) : (
              topVendors.map((v, i) => (
                <VendorItem
                  key={v.nama}
                  name={v.nama}
                  jobs={v.jobs}
                  chipClass={['bg-gradient-to-br from-amber-400 to-yellow-500 text-white', 'bg-gradient-to-br from-slate-300 to-slate-400 text-white', 'bg-gradient-to-br from-orange-400 to-amber-600 text-white'][i] ?? 'bg-slate-100 text-slate-600'}
                  number={i + 1}
                />
              ))
            )}
          </div>
          <button onClick={() => navigate('/vendors')} className="text-sm text-rose-500 hover:text-rose-600 font-medium mt-4">Lihat semua vendor</button>
        </section>
      </div>

      {/* Charts: Pendapatan + Job Masuk vs Selesai */}
      <div className="grid lg:grid-cols-3 gap-4">
        {/* Pendapatan 6 Bulan */}
        <section className="card p-4 lg:col-span-1">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-slate-900">Pendapatan 6 Bulan Terakhir</h2>
          </div>
          <BarChart data={barData} />
        </section>

        {/* Job Masuk vs Selesai - Line chart */}
        <section className="card p-4 lg:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="font-bold text-slate-900">Job Masuk vs Selesai (6 Bulan)</h2>
              <div className="flex items-center gap-4 mt-1.5 text-xs text-slate-500">
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block" /> Job Masuk</span>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" /> Job Selesai</span>
              </div>
            </div>
            <select className="text-xs border border-slate-200 rounded-lg px-2 py-1 bg-white text-slate-600">
              <option>6 Bulan</option>
            </select>
          </div>
          <LineChart data={lineData} />
        </section>
      </div>
    </div>
  )
}

function RingkasanItem({ icon, label, value, chipClass }: { icon: React.ReactNode; label: string; value: string; chipClass: string }) {
  return (
    <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100">
      <div className="flex items-center gap-3">
        <div className={`w-9 h-9 rounded-full ${chipClass} flex items-center justify-center shrink-0`}>
          {icon}
        </div>
        <p className="text-sm font-medium text-slate-900">{label}</p>
      </div>
      <span className="text-lg font-bold text-slate-900">{value}</span>
    </div>
  )
}

function StatusBar({ label, value, max, color, chipClass, icon }: { label: string; value: number; max: number; color: string; chipClass: string; icon: React.ReactNode }) {
  const pct = max > 0 ? (value / max) * 100 : 0
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-2.5">
          <span className={`w-9 h-9 rounded-full ${chipClass} flex items-center justify-center shrink-0`}>
            {icon}
          </span>
          <span className="text-sm text-slate-600">{label}</span>
        </div>
        <span className="text-sm font-bold text-slate-900">{value} Job</span>
      </div>
      <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all duration-500`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

function VendorItem({ name, jobs, chipClass, number }: { name: string; jobs: number; chipClass: string; number: number }) {
  const Icon = number === 1 ? Trophy : Medal
  const initials = name.split(' ').map(w => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase()
  
  return (
    <div className="flex items-center gap-3">
      <div className="w-11 h-11 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center font-semibold text-sm shrink-0">
        {initials || '?'}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-slate-900 truncate">{name}</p>
        <p className="text-sm text-blue-600">{jobs} Job</p>
      </div>
      <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full ${chipClass} shrink-0`}>
        <Icon className="w-3.5 h-3.5" />
        <span className="text-xs font-bold">#{number}</span>
      </div>
    </div>
  )
}

function LineChart({ data }: { data: { label: string; masuk: number; selesai: number }[] }) {
  const W = 560
  const H = 160
  const PAD = 28
  const max = Math.max(...data.map((d) => Math.max(d.masuk, d.selesai)), 1)
  const x = (i: number) => PAD + (i * (W - PAD * 2)) / Math.max(data.length - 1, 1)
  const y = (v: number) => H - PAD - (v / max) * (H - PAD * 2)

  const line = (key: 'masuk' | 'selesai') =>
    data.map((d, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${y(d[key]).toFixed(1)}`).join(' ')

  const area = (key: 'masuk' | 'selesai') =>
    `${line(key)} L ${x(data.length - 1).toFixed(1)} ${(H - PAD).toFixed(1)} L ${x(0).toFixed(1)} ${(H - PAD).toFixed(1)} Z`

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
        <defs>
          <linearGradient id="gradMasuk" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f43f5e" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#f43f5e" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="gradSelesai" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#10b981" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75, 1].map((g) => (
          <line key={g} x1={PAD} x2={W - PAD} y1={y(max * g)} y2={y(max * g)} stroke="#e2e8f0" strokeDasharray="3 3" />
        ))}
        <path d={area('selesai')} fill="url(#gradSelesai)" />
        <path d={area('masuk')} fill="url(#gradMasuk)" />
        <path d={line('selesai')} fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        <path d={line('masuk')} fill="none" stroke="#f43f5e" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        {data.map((d, i) => (
          <g key={d.label}>
            <circle cx={x(i)} cy={y(d.masuk)} r="3.5" fill="#f43f5e" />
            <circle cx={x(i)} cy={y(d.selesai)} r="3.5" fill="#10b981" />
          </g>
        ))}
      </svg>
      <div className="flex justify-between px-6 mt-1 text-xs text-slate-500">
        {data.map((d) => (
          <span key={d.label}>{d.label}</span>
        ))}
      </div>
    </div>
  )
}

function BarChart({ data }: { data: { label: string; total: number }[] }) {
  const max = Math.max(...data.map((d) => d.total), 1)
  return (
    <div className="space-y-3">
      {data.map((d) => {
        const pct = (d.total / max) * 100
        return (
          <div key={d.label}>
            <div className="flex items-center justify-between mb-1 text-xs">
              <span className="text-slate-600">{d.label}</span>
              <span className="font-semibold text-slate-900">{rupiah(d.total)}</span>
            </div>
            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-pink-400 to-rose-500 rounded-full transition-all duration-500"
                style={{ width: `${Math.max(pct, 2)}%` }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}
