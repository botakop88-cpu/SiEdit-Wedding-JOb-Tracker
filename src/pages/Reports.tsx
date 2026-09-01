import { useEffect, useState, useMemo } from 'react'
import { Download, Briefcase, TrendingUp, Calendar, CheckCircle2, AlertTriangle, Wallet, TrendingDown, Users, Scissors, RotateCcw } from 'lucide-react'
import { supabase } from '../lib/supabaseClient'
import { rupiah } from '../lib/utils'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']

interface RawJob {
  nama_project: string
  harga: number
  total_dibayar: number
  tanggal_lunas: string | null
  deadline: string | null
  created_at: string
  jenis_edit: string
  status_edit: string
  status_bayar: string
  status_cetak: string
  catatan: string | null
  vendor: { nama: string } | null
}

interface RawPayment {
  id: string
  job_id: string
  jumlah: number
  tanggal: string
  job: { nama_project: string; jenis_edit: string; vendor: { nama: string } | null } | null
}

interface VendorRow {
  id: string
  nama: string
}

const TAB = [
  { id: 'ringkasan', label: 'Ringkasan', icon: TrendingUp },
  { id: 'job', label: 'Job', icon: Briefcase },
  { id: 'keuangan', label: 'Keuangan', icon: Wallet },
  { id: 'vendor', label: 'Vendor', icon: Users },
  { id: 'jenis', label: 'Jenis Edit', icon: Scissors },
  { id: 'revisi', label: 'Revisi', icon: RotateCcw },
] as const
type TabId = (typeof TAB)[number]['id']

const DONUT_PALETTE = ['#f43f5e', '#f97316', '#8b5cf6', '#0ea5e9', '#10b981', '#eab308', '#6366f1', '#64748b']
const STATUS_COLORS: Record<string, string> = {
  Masuk: '#0ea5e9',
  'Sedang Edit': '#f97316',
  Revisi: '#eab308',
  Selesai: '#10b981',
}

/* ─── Chart primitives ───────────────────────────────────────── */

function Donut({ data, centerLabel, centerValue }: { data: { label: string; value: number; color: string }[]; centerLabel: string; centerValue: string }) {
  const total = data.reduce((s, d) => s + d.value, 0) || 1
  const R = 40
  const C = 2 * Math.PI * R
  let acc = 0
  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative w-40 h-40">
        <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
          {data.map((d) => {
            const frac = d.value / total
            const dash = frac * C
            const offset = -acc * C
            acc += frac
            return (
              <circle
                key={d.label}
                cx="50" cy="50" r={R} fill="none"
                stroke={d.color} strokeWidth="14"
                strokeDasharray={`${dash} ${C - dash}`}
                strokeDashoffset={offset}
                strokeLinecap="butt"
                className="transition-all duration-700"
              />
            )
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-extrabold text-slate-900">{centerValue}</span>
          <span className="text-[11px] text-slate-500">{centerLabel}</span>
        </div>
      </div>
      <div className="w-full space-y-1.5">
        {data.map((d) => (
          <div key={d.label} className="flex items-center gap-2 text-sm">
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: d.color }} />
            <span className="text-slate-600 flex-1 truncate">{d.label}</span>
            <span className="font-semibold text-slate-900">{d.value}</span>
            <span className="text-xs text-slate-400 w-10 text-right">{((d.value / total) * 100).toFixed(0)}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function VBar({ data, colors, labels }: { data: (number | [number, number])[]; colors: string[]; labels: string[] }) {
  const grouped = Array.isArray(data[0])
  const seriesCount = grouped ? (data[0] as number[]).length : 1
  const W = 560
  const H = 200
  const PAD = 30
  const bottom = 20
  const top = 14
  const max = Math.max(...data.flatMap((d) => Array.isArray(d) ? d : [d]), 1)
  const innerW = W - PAD * 2
  const slot = innerW / labels.length
  const barW = grouped ? Math.min(slot * 0.28, 18) : Math.min(slot * 0.5, 26)
  const innerH = H - PAD - bottom - top

  const yGrid = [0, 0.25, 0.5, 0.75, 1]

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
        {yGrid.map((g) => {
          const y = PAD + innerH - g * innerH
          const v = max * g
          return (
            <g key={g}>
              <line x1={PAD} x2={W - PAD} y1={y} y2={y} stroke="#e2e8f0" strokeDasharray="3 3" />
              <text x={PAD - 5} y={y + 3} textAnchor="end" fontSize="8" fill="#94a3b8">
                {v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}jt` : v >= 1000 ? `${Math.round(v / 1000)}rb` : Math.round(v)}
              </text>
            </g>
          )
        })}
        {data.map((d, i) => {
          const cx = PAD + slot * i + slot / 2
          const vals = Array.isArray(d) ? d : [d]
          const offset = grouped ? (barW * seriesCount + 3) / 2 : 0
          return (
            <g key={i}>
              {vals.map((v, s) => {
                const h = (v / max) * innerH
                const x = cx - offset + (grouped ? s * (barW + 3) : 0)
                const y = PAD + innerH - h
                return (
                  <rect
                    key={s}
                    x={x} y={y} width={barW} height={Math.max(h, v > 0 ? 2 : 0)}
                    rx="3" fill={colors[s % colors.length]}
                    className="animate-growBar origin-bottom"
                    style={{ animation: 'growBar 0.6s ease-out' }}
                  >
                    <title>{`${labels[i]}: ${rupiah(v)}`}</title>
                  </rect>
                )
              })}
            </g>
          )
        })}
      </svg>
      <div className="flex px-6 mt-1 text-[11px] text-slate-500">
        {labels.map((l) => (
          <span key={l} className="flex-1 text-center truncate">{l}</span>
        ))}
      </div>
    </div>
  )
}

function HBar({ data, color = '#f43f5e' }: { data: { label: string; value: number }[]; color?: string }) {
  const max = Math.max(...data.map((d) => d.value), 1)
  return (
    <div className="space-y-3">
      {data.map((d) => (
        <div key={d.label}>
          <div className="flex items-center justify-between text-sm mb-1">
            <span className="text-slate-600 truncate">{d.label}</span>
            <span className="font-semibold text-slate-900 shrink-0 ml-2">{rupiah(d.value)}</span>
          </div>
          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{ width: `${Math.max((d.value / max) * 100, d.value > 0 ? 2 : 0)}%`, background: color }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}

function Spline({ series, labels, hidden }: { series: { label: string; color: string; data: number[] }[]; labels: string[]; hidden: Set<string> }) {
  const W = 560
  const H = 200
  const PAD = 30
  const bottom = 20
  const top = 14
  const innerW = W - PAD * 2
  const innerH = H - PAD - bottom - top
  const max = Math.max(...series.flatMap((s) => hidden.has(s.label) ? [] : s.data), 1)

  const x = (i: number) => PAD + (i * innerW) / Math.max(labels.length - 1, 1)
  const y = (v: number) => PAD + innerH - (v / max) * innerH

  const smoothPath = (pts: { x: number; y: number }[]) => {
    if (pts.length === 0) return ''
    if (pts.length === 1) return `M ${pts[0].x} ${pts[0].y}`
    let d = `M ${pts[0].x} ${pts[0].y}`
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[Math.max(0, i - 1)]
      const p1 = pts[i]
      const p2 = pts[i + 1]
      const p3 = pts[Math.min(pts.length - 1, i + 2)]
      const c1x = p1.x + (p2.x - p0.x) / 6
      const c1y = p1.y + (p2.y - p0.y) / 6
      const c2x = p2.x - (p3.x - p1.x) / 6
      const c2y = p2.y - (p3.y - p1.y) / 6
      d += ` C ${c1x.toFixed(1)} ${c1y.toFixed(1)}, ${c2x.toFixed(1)} ${c2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`
    }
    return d
  }

  const yGrid = [0, 0.25, 0.5, 0.75, 1]

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
        {yGrid.map((g) => {
          const yy = PAD + innerH - g * innerH
          return <line key={g} x1={PAD} x2={W - PAD} y1={yy} y2={yy} stroke="#e2e8f0" strokeDasharray="3 3" />
        })}
        {series.map((s) => {
          if (hidden.has(s.label)) return null
          const pts = s.data.map((v, i) => ({ x: x(i), y: y(v) }))
          const d = smoothPath(pts)
          const area = `${d} L ${x(s.data.length - 1)} ${PAD + innerH} L ${x(0)} ${PAD + innerH} Z`
          return (
            <g key={s.label}>
              <path d={area} fill={s.color} opacity="0.08" />
              <path d={d} fill="none" stroke={s.color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
              {pts.map((p, i) => (
                <circle key={i} cx={p.x} cy={p.y} r="3" fill="#fff" stroke={s.color} strokeWidth="2">
                  <title>{`${s.label} ${labels[i]}: ${s.data[i]}`}</title>
                </circle>
              ))}
            </g>
          )
        })}
      </svg>
      <div className="flex px-6 mt-1 text-[11px] text-slate-500">
        {labels.map((l) => (
          <span key={l} className="flex-1 text-center truncate">{l}</span>
        ))}
      </div>
    </div>
  )
}

function AreaChart({ data, labels, color = '#f472b6' }: { data: number[]; labels: string[]; color?: string }) {
  const W = 560
  const H = 180
  const PAD = 28
  const bottom = 18
  const innerW = W - PAD * 2
  const innerH = H - PAD - bottom
  const max = Math.max(...data, 1)
  const x = (i: number) => PAD + (i * innerW) / Math.max(labels.length - 1, 1)
  const y = (v: number) => PAD + innerH - (v / max) * innerH
  const pts = data.map((v, i) => ({ x: x(i), y: y(v) }))
  const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')
  const area = `${line} L ${x(data.length - 1)} ${PAD + innerH} L ${x(0)} ${PAD + innerH} Z`

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
        <defs>
          <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.35" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75, 1].map((g) => (
          <line key={g} x1={PAD} x2={W - PAD} y1={y(max * g)} y2={y(max * g)} stroke="#e2e8f0" strokeDasharray="3 3" />
        ))}
        <path d={area} fill="url(#areaGrad)" />
        <path d={line} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        {pts.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r="3" fill="#fff" stroke={color} strokeWidth="2">
            <title>{`${labels[i]}: ${data[i]}`}</title>
          </circle>
        ))}
      </svg>
      <div className="flex px-6 mt-1 text-[11px] text-slate-500">
        {labels.map((l) => (
          <span key={l} className="flex-1 text-center truncate">{l}</span>
        ))}
      </div>
    </div>
  )
}

function Heatmap({ dayCounts }: { dayCounts: number[] }) {
  const max = Math.max(...dayCounts, 1)
  const cellColor = (v: number) => {
    const t = v / max
    if (v === 0) return '#f1f5f9'
    return `rgb(${Math.round(241 - t * 150)}, ${Math.round(245 - t * 140)}, ${Math.round(249 - t * 190)})`
  }
  return (
    <div className="grid grid-cols-10 md:grid-cols-[repeat(16,minmax(0,1fr))] gap-1.5">
      {dayCounts.map((v, i) => {
        const day = i + 1
        return (
          <div
            key={day}
            title={`Tanggal ${day}: ${v} job`}
            className="aspect-square rounded-md flex items-center justify-center text-[10px] font-semibold"
            style={{ background: cellColor(v), color: v > max * 0.5 ? '#fff' : '#334155' }}
          >
            {day}
          </div>
        )
      })}
    </div>
  )
}

/* ─── Main ───────────────────────────────────────────────────── */

export default function Reports() {
  const now = new Date()
  const curMonth = now.getMonth()
  const curYear = now.getFullYear()

  const [tab, setTab] = useState<TabId>('ringkasan')
  const [fromMonth, setFromMonth] = useState(curMonth >= 5 ? curMonth - 5 : curMonth + 7)
  const [fromYear, setFromYear] = useState(curMonth >= 5 ? curYear : curYear - 1)
  const [toMonth, setToMonth] = useState(curMonth)
  const [toYear, setToYear] = useState(curYear)
  const [jobs, setJobs] = useState<RawJob[]>([])
  const [payments, setPayments] = useState<RawPayment[]>([])
  const [vendors, setVendors] = useState<VendorRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const years = Array.from({ length: curYear - 2019 }, (_, i) => 2020 + i)

  function dateStr(year: number, month: number) {
    return `${year}-${String(month + 1).padStart(2, '0')}`
  }

  function monthEnd(year: number, month: number) {
    const d = new Date(year, month + 1, 0)
    return `${year}-${String(month + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }

  function allMonths() {
    const list: { year: number; month: number; label: string }[] = []
    let y = fromYear, m = fromMonth
    while (y < toYear || (y === toYear && m <= toMonth)) {
      list.push({ year: y, month: m, label: `${MONTHS[m]} ${y}` })
      m++
      if (m > 11) { m = 0; y++ }
    }
    return list
  }

  const monthList = useMemo(() => allMonths(), [fromYear, fromMonth, toYear, toMonth])

  useEffect(() => { loadData() }, [fromYear, fromMonth, toYear, toMonth])

  async function loadData() {
    setLoading(true)
    setError('')
    const from = dateStr(fromYear, fromMonth) + '-01'
    const to = monthEnd(toYear, toMonth)
    const [jobRes, paymentRes, vendorRes] = await Promise.all([
      supabase
        .from('job')
        .select('nama_project, harga, total_dibayar, tanggal_lunas, deadline, created_at, jenis_edit, status_edit, status_bayar, status_cetak, catatan, vendor:vendor_id(nama)')
        .is('deleted_at', null)
        .gte('created_at', from)
        .lte('created_at', to + 'T23:59:59')
        .order('created_at', { ascending: false }),
      // Basis SEMUA angka uang/pendapatan: baris pembayaran (DP/cicilan/lunas) yang
      // tanggalnya ada di periode ini — bukan job.tanggal_lunas, supaya DP yang diterima
      // di periode ini ikut terhitung walau job-nya baru lunas penuh di periode lain.
      supabase
        .from('job_payment')
        .select('id, job_id, jumlah, tanggal, job:job_id(nama_project, jenis_edit, vendor:vendor_id(nama))')
        .gte('tanggal', from)
        .lte('tanggal', to)
        .order('tanggal', { ascending: false }),
      supabase.from('vendor').select('id, nama').is('deleted_at', null),
    ])
    if (jobRes.error) {
      setError(jobRes.error.message)
      setLoading(false)
      return
    }
    if (paymentRes.error) {
      setError(paymentRes.error.message)
      setLoading(false)
      return
    }
    setJobs((jobRes.data ?? []) as unknown as RawJob[])
    setPayments((paymentRes.data ?? []) as unknown as RawPayment[])
    setVendors((vendorRes.data ?? []) as VendorRow[])
    setLoading(false)
  }

  /* ─── Computed ───────────────────────────────────── */

  // jobsCreated: job yang MASUK (dibuat) dalam periode -> untuk hitungan job/status.
  // payments (dari state, sudah difilter tanggal di query): SEMUA baris pembayaran
  // (DP/cicilan/lunas) di periode ini -> basis SEMUA angka uang/pendapatan. Ini penting
  // supaya DP yang diterima bulan ini tetap terhitung sebagai pendapatan bulan ini, walau
  // job-nya baru lunas penuh (atau belum lunas sama sekali) di bulan lain.
  const jobsCreated = jobs

  const totalJobs = jobsCreated.length
  const totalPendapatan = payments.reduce((s, p) => s + p.jumlah, 0)
  const totalOutstanding = jobsCreated.reduce((s, j) => s + Math.max(0, j.harga - (j.total_dibayar ?? 0)), 0)
  const booking = jobsCreated.filter((j) => j.status_edit === 'Masuk').length
  const sedangEdit = jobsCreated.filter((j) => j.status_edit === 'Sedang Edit').length
  const revisiCount = jobsCreated.filter((j) => j.status_edit === 'Revisi').length
  const selesaiCount = jobsCreated.filter((j) => j.status_edit === 'Selesai').length

  const statusSeries = [
    { label: 'Selesai', value: selesaiCount, color: STATUS_COLORS.Selesai },
    { label: 'Sedang Edit', value: sedangEdit, color: STATUS_COLORS['Sedang Edit'] },
    { label: 'Masuk', value: booking, color: STATUS_COLORS.Masuk },
    { label: 'Revisi', value: revisiCount, color: STATUS_COLORS.Revisi },
  ]

  const monthlyRevenue = useMemo(() => {
    return monthList.map(({ year, month, label }) => {
      const key = `${year}-${String(month + 1).padStart(2, '0')}`
      const total = payments.filter((p) => p.tanggal.startsWith(key)).reduce((s, p) => s + p.jumlah, 0)
      return { label, total }
    })
  }, [payments, monthList])

  const jenisDist = useMemo(() => {
    const map = new Map<string, number>()
    for (const j of jobsCreated) map.set(j.jenis_edit, (map.get(j.jenis_edit) ?? 0) + 1)
    return Array.from(map.entries()).map(([label, value], i) => ({ label, value, color: DONUT_PALETTE[i % DONUT_PALETTE.length] })).sort((a, b) => b.value - a.value)
  }, [jobsCreated])

  const vendorPerformance = useMemo(() => {
    const map = new Map<string, { name: string; totalJob: number; pendapatan: number; outstanding: number; selesai: number; belumBayar: number }>()
    for (const v of vendors) map.set(v.nama, { name: v.nama, totalJob: 0, pendapatan: 0, outstanding: 0, selesai: 0, belumBayar: 0 })
    for (const j of jobsCreated) {
      const name = j.vendor?.nama ?? 'Tanpa Vendor'
      if (!map.has(name)) map.set(name, { name, totalJob: 0, pendapatan: 0, outstanding: 0, selesai: 0, belumBayar: 0 })
      const s = map.get(name)!
      s.totalJob++
      if (j.status_bayar !== 'Lunas') {
        s.outstanding += Math.max(0, j.harga - (j.total_dibayar ?? 0))
        s.belumBayar++
      }
      if (j.status_edit === 'Selesai') s.selesai++
    }
    // Pendapatan dihitung TERPISAH dari populasi payments (basis tanggal pembayaran),
    // supaya job vendor yang dibuat di luar periode tapi dibayar (DP/cicilan/lunas) di
    // dalam periode tetap tercatat pendapatannya untuk vendor itu.
    for (const p of payments) {
      const name = p.job?.vendor?.nama ?? 'Tanpa Vendor'
      if (!map.has(name)) map.set(name, { name, totalJob: 0, pendapatan: 0, outstanding: 0, selesai: 0, belumBayar: 0 })
      map.get(name)!.pendapatan += p.jumlah
    }
    return Array.from(map.values()).sort((a, b) => b.pendapatan - a.pendapatan)
  }, [jobsCreated, payments, vendors])

  const jenisRevenue = useMemo(() => {
    const map = new Map<string, number>()
    for (const p of payments) {
      const jenis = p.job?.jenis_edit ?? '-'
      map.set(jenis, (map.get(jenis) ?? 0) + p.jumlah)
    }
    return Array.from(map.entries()).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value)
  }, [payments])

  const revisionJobs = useMemo(() => {
    return jobsCreated.filter((j) => j.status_edit === 'Revisi' || (j.catatan?.toLowerCase().includes('revisi')))
  }, [jobsCreated])

  const monthLabels = monthlyRevenue.map((m) => m.label.split(' ')[0])

  const maxPendapatan = monthlyRevenue.reduce((m, r) => Math.max(m, r.total), 0)

  const monthlyJobs = useMemo(() => {
    return monthList.map(({ year, month }) => {
      const key = `${year}-${String(month + 1).padStart(2, '0')}`
      return jobsCreated.filter((j) => (j.created_at ?? '').slice(0, 7) === key).length
    })
  }, [jobsCreated, monthList])

  // Catatan: "Selesai" di grafik trend ini sengaja dihitung dari status job SEKARANG yang
  // dibuat di bulan itu (konsisten dengan "Sedang Edit"/"Batal"), bukan dari tanggal
  // pembayaran seperti versi sebelumnya — supaya definisinya konsisten antar 3 garis.
  const trendSeries = [
    { label: 'Selesai', color: '#10b981', data: monthList.map((m) => jobsCreated.filter((j) => (j.created_at ?? '').slice(0, 7) === `${m.year}-${String(m.month + 1).padStart(2, '0')}` && j.status_edit === 'Selesai').length) },
    { label: 'Sedang Edit', color: '#f97316', data: monthList.map((m) => jobsCreated.filter((j) => (j.created_at ?? '').slice(0, 7) === `${m.year}-${String(m.month + 1).padStart(2, '0')}` && j.status_edit === 'Sedang Edit').length) },
    { label: 'Batal', color: '#e11d48', data: monthList.map((m) => jobsCreated.filter((j) => (j.created_at ?? '').slice(0, 7) === `${m.year}-${String(m.month + 1).padStart(2, '0')}` && j.status_edit === 'Batal').length) },
  ]

  const [hiddenSeries, setHiddenSeries] = useState<Set<string>>(new Set())
  function toggleSeries(label: string) {
    setHiddenSeries((prev) => {
      const next = new Set(prev)
      if (next.has(label)) next.delete(label)
      else next.add(label)
      return next
    })
  }

  const dayCounts = useMemo(() => {
    const arr = new Array(31).fill(0)
    for (const j of jobsCreated) {
      const d = j.deadline ? Number(j.deadline.slice(8, 10)) : NaN
      if (d >= 1 && d <= 31) arr[d - 1]++
    }
    return arr
  }, [jobsCreated])

  const revisionDaily = useMemo(() => {
    return monthList.map(({ year, month, label }) => {
      const key = `${year}-${String(month + 1).padStart(2, '0')}`
      const count = jobsCreated.filter((j) => (j.created_at ?? '').slice(0, 7) === key && (j.status_edit === 'Revisi' || (j.catatan ?? '').toLowerCase().includes('revisi'))).length
      return { label: label.split(' ')[0], count }
    })
  }, [jobsCreated, monthList])

  /* ─── Export ───────────────────────────────────── */

  async function dataExportXLSX() {
    const { default: ExcelJS } = await import('exceljs')
    const cols = ['TANGGAL BAYAR', 'PROYEK', 'VENDOR', 'JENIS EDIT', 'JUMLAH DIBAYAR']
    const fmtHarga = (v: number) => 'Rp' + v.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')
    const fmtDate = (v: string | null | undefined) => {
      if (!v) return '-'
      const [y, m, d] = v.split('-')
      return y && m && d ? `${d}/${m}/${y}` : v
    }
    const rows = payments.map((p) => [
      fmtDate(p.tanggal), p.job?.nama_project ?? '-', p.job?.vendor?.nama ?? '-', p.job?.jenis_edit ?? '-', fmtHarga(p.jumlah),
    ])
    const totalLunas = payments.reduce((s, p) => s + p.jumlah, 0)
    const workbook = new ExcelJS.Workbook()
    const sheet = workbook.addWorksheet('Laporan SiEdit')
    const periode = `${monthList[0]?.label ?? ''} — ${monthList[monthList.length - 1]?.label ?? ''}`
    sheet.addRow(['LAPORAN PENGHASILAN SIEDIT'])
    sheet.addRow([periode])
    sheet.mergeCells(1, 1, 1, cols.length)
    sheet.mergeCells(2, 1, 2, cols.length)
    const titleRow = sheet.getRow(1)
    titleRow.height = 24
    titleRow.font = { bold: true, size: 14, color: { argb: 'FF881337' } }
    titleRow.alignment = { vertical: 'middle', horizontal: 'center' }
    const periodeRow = sheet.getRow(2)
    periodeRow.height = 16
    periodeRow.font = { size: 10, italic: true, color: { argb: 'FF64748B' } }
    periodeRow.alignment = { vertical: 'middle', horizontal: 'center' }
    sheet.addRow(cols)
    const headerRow = sheet.getRow(3)
    headerRow.height = 20
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE11D48' } }
    rows.forEach((r) => sheet.addRow(r))
    const totalRow = sheet.addRow(['TOTAL', '', '', `${payments.length} pembayaran`, fmtHarga(totalLunas)])
    totalRow.font = { bold: true }
    totalRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF1F2' } }
    const allRows = [cols, ...rows, ['TOTAL', '', '', `${payments.length} pembayaran`, fmtHarga(totalLunas)]]
    cols.forEach((_, ci) => {
      const maxLen = allRows.reduce((m, r) => Math.max(m, String(r[ci] ?? '').length), cols[ci].length)
      sheet.getColumn(ci + 1).width = Math.min(Math.max(maxLen + 2, 10), 45)
    })
    sheet.views = [{ state: 'frozen', ySplit: 3 }]
    const buffer = await workbook.xlsx.writeBuffer()
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `laporan-siedit-${dateStr(fromYear, fromMonth)}-${dateStr(toYear, toMonth)}.xlsx`
    a.click()
    URL.revokeObjectURL(url)
  }

  /* ─── Render helpers ───────────────────────────── */

  function Metric({ icon, label, value, sub, accent }: { icon: React.ReactNode; label: string; value: string; sub?: string; accent?: string }) {
    return (
      <div className="card p-4 relative overflow-hidden">
        <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
          <span className={`w-8 h-8 rounded-full ${accent ?? 'bg-rose-500/10'} text-slate-600 flex items-center justify-center`}>{icon}</span>
          <span className="font-medium">{label}</span>
        </div>
        <p className="text-lg font-bold text-slate-900">{value}</p>
        {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
      </div>
    )
  }

  function Card({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
    return (
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-slate-900">{title}</h3>
          {action}
        </div>
        {children}
      </div>
    )
  }

  if (loading) {
    return (
      <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-4">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-4 border-rose-500 border-t-transparent" />
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-4">
      {/* ── Tab navigation ───────────────────────── */}
      <div className="card p-1.5">
        <div className="flex flex-wrap items-center gap-1">
          {TAB.map((t) => {
            const Icon = t.icon
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-semibold transition-all ${
                  tab === t.id ? 'bg-gradient-to-r from-rose-600 to-rose-500 text-white shadow-md shadow-rose-500/30' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Icon className="w-4 h-4" /> {t.label}
              </button>
            )
          })}
          <div className="flex-1" />
          <button onClick={dataExportXLSX} className="btn-secondary !py-1.5">
            <Download className="w-4 h-4" /> Excel
          </button>
        </div>
      </div>

      {/* ── Period filter ───────────────────────── */}
      <div className="card p-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="micro-label mr-1">Periode</span>
          <select value={fromMonth} onChange={(e) => setFromMonth(Number(e.target.value))} className="input-base !w-auto !py-1.5">
            {MONTHS.map((m, i) => <option key={i} value={i}>{m}</option>)}
          </select>
          <select value={fromYear} onChange={(e) => setFromYear(Number(e.target.value))} className="input-base !w-auto !py-1.5">
            {years.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
          <span className="text-slate-500 text-sm">—</span>
          <select value={toMonth} onChange={(e) => setToMonth(Number(e.target.value))} className="input-base !w-auto !py-1.5">
            {MONTHS.map((m, i) => <option key={i} value={i}>{m}</option>)}
          </select>
          <select value={toYear} onChange={(e) => setToYear(Number(e.target.value))} className="input-base !w-auto !py-1.5">
            {years.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      {error && <div className="bg-red-500/10 border border-red-500/25 text-red-600 text-sm rounded-lg px-4 py-3">{error}</div>}

      {/* ── RINGKASAN ────────────────────────────── */}
      {tab === 'ringkasan' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <Metric icon={<Briefcase className="w-4 h-4" />} label="Total Job" value={String(totalJobs)} accent="bg-rose-500/10" />
            <Metric icon={<Calendar className="w-4 h-4" />} label="Booking" value={String(booking)} accent="bg-sky-500/10" />
            <Metric icon={<TrendingUp className="w-4 h-4" />} label="Sedang Edit" value={String(sedangEdit)} accent="bg-orange-500/10" />
            <Metric icon={<AlertTriangle className="w-4 h-4" />} label="Revisi" value={String(revisiCount)} accent="bg-amber-500/10" />
            <Metric icon={<Wallet className="w-4 h-4" />} label="Total Pendapatan" value={rupiah(totalPendapatan)} accent="bg-emerald-500/10" />
          </div>

          <div className="grid lg:grid-cols-3 gap-4">
            <Card title="Job per Status">
              <Donut data={statusSeries} centerLabel="Total" centerValue={String(totalJobs)} />
            </Card>
            <Card title="Pendapatan (Per Bulan)">
              <VBar data={monthlyRevenue.map((m) => m.total)} colors={['#f43f5e']} labels={monthLabels} />
            </Card>
            <Card title="Job per Jenis Edit">
              <Donut data={jenisDist} centerLabel="Jenis" centerValue={String(jenisDist.reduce((s, d) => s + d.value, 0))} />
            </Card>
          </div>

          <div className="grid lg:grid-cols-2 gap-4">
            <Card
              title="Top 5 Vendor (Berdasarkan Pendapatan)"
              action={<button onClick={() => setTab('vendor')} className="text-xs text-rose-500 hover:text-rose-600 font-medium">Lihat Semua Vendor</button>}
            >
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-slate-500 border-b border-slate-200">
                      <th className="py-2 pr-2 font-medium">Rank</th>
                      <th className="py-2 pr-2 font-medium">Nama Vendor</th>
                      <th className="py-2 pr-2 font-medium text-right">Total Job</th>
                      <th className="py-2 pr-2 font-medium text-right">Piutang</th>
                      <th className="py-2 font-medium text-right">Pendapatan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {vendorPerformance.slice(0, 5).map((v, i) => (
                      <tr key={v.name}>
                        <td className="py-2.5 pr-2">
                          <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white ${i === 0 ? 'bg-amber-400' : i === 1 ? 'bg-slate-500' : i === 2 ? 'bg-amber-700' : 'bg-slate-600'}`}>{i + 1}</span>
                        </td>
                        <td className="py-2.5 pr-2 font-medium text-slate-900">{v.name}</td>
                        <td className="py-2.5 pr-2 text-right text-slate-600">{v.totalJob}</td>
                        <td className="py-2.5 pr-2 text-right text-orange-600">{rupiah(v.outstanding)}</td>
                        <td className="py-2.5 text-right font-semibold text-emerald-600">{rupiah(v.pendapatan)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>

            <Card title="Job Terbaru">
              <div className="space-y-2.5">
                {jobs.slice(0, 5).map((j) => (
                  <div key={j.nama_project + j.deadline + j.harga} className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 text-xs font-bold shrink-0">
                      {(j.vendor?.nama ?? '?').split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="inline-block px-2 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-700 mb-0.5">{j.jenis_edit}</span>
                      <p className="text-sm font-medium text-slate-900 truncate">{j.nama_project}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-semibold text-slate-900">{rupiah(j.harga)}</p>
                      <p className="text-xs text-slate-400">{j.deadline ? j.deadline.slice(8, 10) + '/' + j.deadline.slice(5, 7) : '—'}</p>
                    </div>
                  </div>
                ))}
                {jobs.length === 0 && <p className="text-sm text-slate-400 text-center py-6">Belum ada job di periode ini.</p>}
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* ── JOB ─────────────────────────────────── */}
      {tab === 'job' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <Metric icon={<Briefcase className="w-4 h-4" />} label="Total" value={String(totalJobs)} accent="bg-slate-500/10" />
            <Metric icon={<Calendar className="w-4 h-4" />} label="Pending (Masuk)" value={String(booking)} accent="bg-sky-500/10" />
            <Metric icon={<TrendingUp className="w-4 h-4" />} label="Process" value={String(sedangEdit)} accent="bg-orange-500/10" />
            <Metric icon={<CheckCircle2 className="w-4 h-4" />} label="Done" value={String(selesaiCount)} accent="bg-emerald-500/10" />
            <Metric icon={<AlertTriangle className="w-4 h-4" />} label="Revision" value={String(revisiCount)} accent="bg-amber-500/10" />
            <Metric icon={<TrendingDown className="w-4 h-4" />} label="Cancelled" value="0" accent="bg-rose-500/10" />
          </div>

          <Card
            title="Trend Job"
            action={
              <div className="flex items-center gap-3">
                {trendSeries.map((s) => (
                  <button key={s.label} onClick={() => toggleSeries(s.label)} className="flex items-center gap-1.5 text-xs">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ background: hiddenSeries.has(s.label) ? '#cbd5e1' : s.color }} />
                    <span className={hiddenSeries.has(s.label) ? 'text-slate-400 line-through' : 'text-slate-600'}>{s.label}</span>
                  </button>
                ))}
              </div>
            }
          >
            <div className="grid md:grid-cols-3 gap-4">
              <div className="md:col-span-2">
                <Spline series={trendSeries} labels={monthLabels} hidden={hiddenSeries} />
              </div>
              <div className="space-y-3">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Ringkasan Status</p>
                {statusSeries.map((s) => {
                  const pct = totalJobs > 0 ? (s.value / totalJobs) * 100 : 0
                  return (
                    <div key={s.label}>
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="text-slate-600">{s.label}</span>
                        <span className="font-semibold text-slate-900">{s.value} · {pct.toFixed(0)}%</span>
                      </div>
                      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: s.color }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </Card>

          <Card title="Job per Hari">
            <Heatmap dayCounts={dayCounts} />
          </Card>
        </div>
      )}

      {/* ── KEUANGAN ────────────────────────────── */}
      {tab === 'keuangan' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="card p-5 bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 border-emerald-200">
              <p className="text-sm text-slate-500 mb-1">Total Pendapatan</p>
              <p className="text-2xl font-extrabold text-emerald-600">{rupiah(totalPendapatan)}</p>
            </div>
            <div className="card p-5 bg-gradient-to-br from-amber-500/10 to-amber-500/5 border-amber-200">
              <p className="text-sm text-slate-500 mb-1">Belum Bayar</p>
              <p className="text-2xl font-extrabold text-amber-600">{rupiah(totalOutstanding)}</p>
            </div>
            <div className="card p-5 bg-gradient-to-br from-slate-900 to-slate-800 text-white border-slate-800">
              <p className="text-sm text-slate-400 mb-1">Total Nilai Pekerjaan</p>
              <p className="text-2xl font-extrabold text-white">{rupiah(totalPendapatan + totalOutstanding)}</p>
            </div>
          </div>

          <Card title="Rincian Bulanan">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-slate-500 border-b border-slate-100">
                    <th className="py-2 pr-2 font-medium">Bulan</th>
                    <th className="py-2 pr-2 font-medium text-right">Job</th>
                    <th className="py-2 pr-2 font-medium text-right">Pendapatan</th>
                    <th className="py-2 pr-2 font-medium text-right">vs Sebelumnya</th>
                    <th className="py-2 font-medium">Indikator</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {monthlyRevenue.map((m, i) => {
                    const prev = i > 0 ? monthlyRevenue[i - 1].total : null
                    const momPct = prev && prev > 0 ? ((m.total - prev) / prev) * 100 : null
                    const pct = maxPendapatan > 0 ? (m.total / maxPendapatan) * 100 : 0
                    return (
                      <tr key={m.label} className="hover:bg-slate-50 transition-colors">
                        <td className="py-2.5 pr-2 font-medium text-slate-700">{m.label}</td>
                        <td className="py-2.5 pr-2 text-right text-slate-600">{monthlyJobs[i]}</td>
                        <td className="py-2.5 pr-2 text-right font-medium text-slate-800">{rupiah(m.total)}</td>
                        <td className="py-2.5 pr-2 text-right">
                          {momPct !== null ? (
                            <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${momPct >= 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                              {momPct >= 0 ? '↑' : '↓'} {Math.abs(momPct).toFixed(0)}%
                            </span>
                          ) : (
                            <span className="text-xs text-slate-300">—</span>
                          )}
                        </td>
                        <td className="py-2.5">
                          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full rounded-full bg-gradient-to-r from-rose-300 to-rose-500" style={{ width: `${Math.max(pct, m.total > 0 ? 4 : 2)}%` }} />
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-50 border-t-2 border-slate-200">
                    <td className="py-3 pr-2 text-sm font-bold text-slate-800">TOTAL</td>
                    <td className="py-3 pr-2 text-right text-sm font-bold text-slate-800">{totalJobs}</td>
                    <td className="py-3 pr-2 text-right text-sm font-bold text-slate-800">{rupiah(totalPendapatan)}</td>
                    <td className="py-3" colSpan={2} />
                  </tr>
                </tfoot>
              </table>
            </div>
          </Card>

          <div className="grid lg:grid-cols-2 gap-4">
            <Card title="Pendapatan per Bulan">
              <VBar
                data={monthlyRevenue.map((m) => m.total)}
                colors={['#10b981']}
                labels={monthLabels}
              />
            </Card>

            <Card title="Rincian Keuangan">
              <div className="space-y-3">
                {[
                  { label: 'Sudah Dibayar', value: totalPendapatan, color: '#10b981' },
                  { label: 'Belum Bayar', value: totalOutstanding, color: '#f59e0b' },
                ].map((d) => {
                  const base = Math.max(totalPendapatan + totalOutstanding, 1)
                  const pct = (d.value / base) * 100
                  return (
                    <div key={d.label}>
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="text-slate-600">{d.label}</span>
                        <span className="font-semibold text-slate-900">{rupiah(d.value)} · {pct.toFixed(0)}%</span>
                      </div>
                      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${Math.min(pct, 100)}%`, background: d.color }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </Card>
          </div>

          <Card title="Urutan Pendapatan Per Vendor">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-slate-500 border-b border-slate-200">
                    <th className="py-2 pr-2 font-medium">Vendor</th>
                    <th className="py-2 pr-2 font-medium text-right">Total Job</th>
                    <th className="py-2 pr-2 font-medium text-right">Pendapatan</th>
                    <th className="py-2 pr-2 font-medium text-right">Belum Bayar</th>
                    <th className="py-2 font-medium text-right">Piutang</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {vendorPerformance.map((v) => (
                    <tr key={v.name} className="hover:bg-slate-50/50">
                      <td className="py-2.5 pr-2 font-medium text-slate-900">{v.name}</td>
                      <td className="py-2.5 pr-2 text-right text-slate-600">{v.totalJob}</td>
                      <td className="py-2.5 pr-2 text-right font-semibold text-emerald-600">{rupiah(v.pendapatan)}</td>
                      <td className="py-2.5 pr-2 text-right text-amber-600">{v.belumBayar} job</td>
                      <td className="py-2.5 text-right text-orange-600">{rupiah(v.outstanding)}</td>
                    </tr>
                  ))}
                  {vendorPerformance.length === 0 && (
                    <tr><td colSpan={5} className="py-6 text-center text-slate-400">Belum ada data.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* ── VENDOR ──────────────────────────────── */}
      {tab === 'vendor' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Metric icon={<Users className="w-4 h-4" />} label="Total Vendor" value={String(vendors.length)} accent="bg-sky-500/10" />
            <Metric icon={<Briefcase className="w-4 h-4" />} label="Total Job" value={String(totalJobs)} accent="bg-rose-500/10" />
            <Metric icon={<Wallet className="w-4 h-4" />} label="Gross Earnings" value={rupiah(totalPendapatan)} accent="bg-emerald-500/10" />
            <Metric icon={<TrendingDown className="w-4 h-4" />} label="Piutang" value={rupiah(totalOutstanding)} accent="bg-orange-500/10" />
          </div>

          <div className="grid lg:grid-cols-2 gap-4">
            <Card title="Distribusi Job per Vendor">
              <Donut
                data={vendorPerformance.map((v, i) => ({ label: v.name, value: v.totalJob, color: DONUT_PALETTE[i % DONUT_PALETTE.length] }))}
                centerLabel="Job" centerValue={String(totalJobs)}
              />
            </Card>
            <Card title="Pendapatan per Vendor">
              <HBar data={vendorPerformance.map((v) => ({ label: v.name, value: v.pendapatan }))} color="#10b981" />
            </Card>
          </div>

          <Card title="Performa Vendor">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-slate-500 border-b border-slate-200">
                    <th className="py-2 pr-2 font-medium">#</th>
                    <th className="py-2 pr-2 font-medium">Vendor</th>
                    <th className="py-2 pr-2 font-medium text-right">Total Job</th>
                    <th className="py-2 pr-2 font-medium text-right">Selesai</th>
                    <th className="py-2 pr-2 font-medium text-right">% Selesai</th>
                    <th className="py-2 pr-2 font-medium text-right">Pendapatan</th>
                    <th className="py-2 font-medium text-right">Piutang</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {vendorPerformance.map((v, i) => {
                    const pct = v.totalJob > 0 ? (v.selesai / v.totalJob) * 100 : 0
                    return (
                      <tr key={v.name} className="hover:bg-slate-50/50">
                        <td className="py-2.5 pr-2 text-slate-500">{i + 1}</td>
                        <td className="py-2.5 pr-2 font-medium text-slate-900">{v.name}</td>
                        <td className="py-2.5 pr-2 text-right text-slate-600">{v.totalJob}</td>
                        <td className="py-2.5 pr-2 text-right text-emerald-600">{v.selesai}</td>
                        <td className="py-2.5 pr-2 text-right text-slate-600">{pct.toFixed(0)}%</td>
                        <td className="py-2.5 pr-2 text-right font-semibold text-slate-900">{rupiah(v.pendapatan)}</td>
                        <td className="py-2.5 text-right text-orange-600">{rupiah(v.outstanding)}</td>
                      </tr>
                    )
                  })}
                  {vendorPerformance.length === 0 && (
                    <tr><td colSpan={7} className="py-6 text-center text-slate-400">Belum ada data.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* ── JENIS EDIT ──────────────────────────── */}
      {tab === 'jenis' && (
        <div className="space-y-4">
          <div className="card p-4">
            <div className="flex flex-wrap items-center gap-4">
              {jenisDist.length === 0 && (
                <div className="flex-1 text-center py-4 text-sm text-slate-400">Belum ada data jenis edit.</div>
              )}
              {jenisDist.map((d) => (
                <div key={d.label} className="flex items-center gap-3 flex-1 min-w-[160px]">
                  <span className="w-3 h-3 rounded-full shrink-0" style={{ background: d.color }} />
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-slate-900">{d.label}</p>
                    <p className="text-xs text-slate-500">{d.value} job</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="grid lg:grid-cols-2 gap-4">
            <Card title="Distribusi Job per Jenis Edit">
              <Donut data={jenisDist} centerLabel="Jenis" centerValue={String(totalJobs)} />
            </Card>
            <Card title="Pendapatan per Jenis Edit">
              <VBar data={jenisRevenue.map((d) => d.value)} colors={DONUT_PALETTE} labels={jenisRevenue.map((d) => d.label)} />
            </Card>
          </div>

          <Card title="Rincian per Jenis Edit">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-slate-500 border-b border-slate-200">
                    <th className="py-2 pr-2 font-medium">Jenis Edit</th>
                    <th className="py-2 pr-2 font-medium text-right">Total Job</th>
                    <th className="py-2 pr-2 font-medium text-right">Selesai</th>
                    <th className="py-2 pr-2 font-medium text-right">Pendapatan</th>
                    <th className="py-2 font-medium text-right">Rata-rata per Job</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {jenisDist.map((d) => {
                    const selesai = jobsCreated.filter((j) => j.jenis_edit === d.label && j.status_edit === 'Selesai').length
                    const pendapatan = payments.filter((p) => (p.job?.jenis_edit ?? '-') === d.label).reduce((s, p) => s + p.jumlah, 0)
                    const avg = d.value > 0 ? Math.round(pendapatan / d.value) : 0
                    return (
                      <tr key={d.label} className="hover:bg-slate-50/50">
                        <td className="py-2.5 pr-2">
                          <span className="flex items-center gap-2 font-medium text-slate-900">
                            <span className="w-2.5 h-2.5 rounded-full" style={{ background: d.color }} /> {d.label}
                          </span>
                        </td>
                        <td className="py-2.5 pr-2 text-right text-slate-600">{d.value}</td>
                        <td className="py-2.5 pr-2 text-right text-emerald-600">{selesai}</td>
                        <td className="py-2.5 pr-2 text-right font-semibold text-slate-900">{rupiah(pendapatan)}</td>
                        <td className="py-2.5 text-right text-slate-600">{rupiah(avg)}</td>
                      </tr>
                    )
                  })}
                  {jenisDist.length === 0 && (
                    <tr><td colSpan={5} className="py-6 text-center text-slate-400">Belum ada data.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* ── REVISI ──────────────────────────────── */}
      {tab === 'revisi' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <Metric icon={<RotateCcw className="w-4 h-4" />} label="Total Revisi" value={String(revisionJobs.length)} accent="bg-amber-500/10" />
            <Metric icon={<TrendingUp className="w-4 h-4" />} label="In Progress" value={String(revisionJobs.filter((j) => j.status_edit === 'Revisi').length)} accent="bg-orange-500/10" />
            <Metric icon={<CheckCircle2 className="w-4 h-4" />} label="Done" value={String(revisionJobs.filter((j) => j.status_edit === 'Selesai').length)} accent="bg-emerald-500/10" />
            <Metric icon={<Calendar className="w-4 h-4" />} label="Pending" value={String(revisionJobs.filter((j) => j.status_edit !== 'Revisi' && j.status_edit !== 'Selesai').length)} accent="bg-sky-500/10" />
            <Metric icon={<AlertTriangle className="w-4 h-4" />} label="Avg Rate" value={totalJobs > 0 ? (revisionJobs.length / totalJobs).toFixed(2) : '0.00'} accent="bg-rose-500/10" />
          </div>

          <div className="grid lg:grid-cols-2 gap-4">
            <Card title="Tren Revisi">
              <AreaChart data={revisionDaily.map((d) => d.count)} labels={revisionDaily.map((d) => d.label)} color="#f472b6" />
            </Card>
            <Card title="Status Revisi">
              <Donut
                data={[
                  { label: 'Selesai', value: revisionJobs.filter((j) => j.status_edit === 'Selesai').length, color: '#10b981' },
                  { label: 'Dalam Proses', value: revisionJobs.filter((j) => j.status_edit === 'Revisi').length, color: '#f97316' },
                  { label: 'Pending', value: revisionJobs.filter((j) => j.status_edit !== 'Revisi' && j.status_edit !== 'Selesai').length, color: '#0ea5e9' },
                ]}
                centerLabel="Revisi" centerValue={String(revisionJobs.length)}
              />
            </Card>
          </div>

          <Card title="Detail Job Revisi">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-slate-500 border-b border-slate-200">
                    <th className="py-2 pr-2 font-medium">Project</th>
                    <th className="py-2 pr-2 font-medium">Vendor</th>
                    <th className="py-2 pr-2 font-medium">Tipe</th>
                    <th className="py-2 pr-2 font-medium">Deadline</th>
                    <th className="py-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {revisionJobs.map((j) => (
                    <tr key={j.nama_project + j.deadline + j.harga} className="hover:bg-slate-50/50">
                      <td className="py-2.5 pr-2 font-medium text-slate-900">{j.nama_project}</td>
                      <td className="py-2.5 pr-2 text-slate-600">{j.vendor?.nama ?? '—'}</td>
                      <td className="py-2.5 pr-2 text-slate-600">{j.jenis_edit}</td>
                      <td className="py-2.5 pr-2 text-slate-600">{j.deadline ? j.deadline.slice(8, 10) + '/' + j.deadline.slice(5, 7) + '/' + j.deadline.slice(0, 4) : '—'}</td>
                      <td className="py-2.5">
                        {j.status_edit === 'Selesai' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Done
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-orange-100 text-orange-700">
                            <AlertTriangle className="w-3.5 h-3.5" /> Pending
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {revisionJobs.length === 0 && (
                    <tr><td colSpan={5} className="py-6 text-center text-slate-400">Tidak ada job revisi.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      <style>{`
        @keyframes growBar {
          from { transform: scaleY(0); }
          to { transform: scaleY(1); }
        }
      `}</style>
    </div>
  )
}
