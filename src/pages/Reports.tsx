import { useEffect, useState, useMemo } from 'react'
import { BarChart3, TrendingUp, Award, Briefcase, Calendar, Download } from 'lucide-react'
import { supabase } from '../lib/supabaseClient'
import { rupiah } from '../lib/utils'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']

interface RawJob {
  harga: number
  tanggal_lunas: string | null
  jenis_edit: string
  vendor: { nama: string } | null
}

export default function Reports() {
  const now = new Date()
  const curMonth = now.getMonth()
  const curYear = now.getFullYear()

  const [fromMonth, setFromMonth] = useState(curMonth)
  const [fromYear, setFromYear] = useState(curYear - 1)
  const [toMonth, setToMonth] = useState(curMonth)
  const [toYear, setToYear] = useState(curYear)
  const [raw, setRaw] = useState<RawJob[]>([])
  const [prevTotal, setPrevTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const years = Array.from({ length: curYear - 2019 }, (_, i) => 2020 + i)

  function shiftMonths(year: number, month: number, delta: number) {
    const total = year * 12 + month + delta
    return { year: Math.floor(total / 12), month: ((total % 12) + 12) % 12 }
  }

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
  const monthCount = monthList.length

  useEffect(() => { loadData() }, [fromYear, fromMonth, toYear, toMonth])

  async function loadData() {
    setLoading(true)
    setError('')

    const from = dateStr(fromYear, fromMonth) + '-01'
    const to = monthEnd(toYear, toMonth)

    // Prev period: same length, ending month before current start
    const prevEnd = shiftMonths(fromYear, fromMonth, -1)
    const prevStart = shiftMonths(fromYear, fromMonth, -monthCount)

    const [mainRes, prevRes] = await Promise.all([
      supabase
        .from('job')
        .select('harga, tanggal_lunas, jenis_edit, vendor:vendor_id(nama)')
        .is('deleted_at', null)
        .eq('status_bayar', 'Lunas')
        .gte('tanggal_lunas', from)
        .lte('tanggal_lunas', to)
        .order('tanggal_lunas'),
      supabase
        .from('job')
        .select('harga')
        .is('deleted_at', null)
        .eq('status_bayar', 'Lunas')
        .gte('tanggal_lunas', dateStr(prevStart.year, prevStart.month) + '-01')
        .lte('tanggal_lunas', monthEnd(prevEnd.year, prevEnd.month)),
    ])

    if (mainRes.error) {
      setError(mainRes.error.message)
      setLoading(false)
      return
    }

    setRaw((mainRes.data ?? []) as unknown as RawJob[])
    setPrevTotal(
      (prevRes.data ?? []).reduce((s: number, j: { harga: number }) => s + j.harga, 0)
    )
    setLoading(false)
  }

  // ─── Computed ──────────────────────────────────────

  const monthly = useMemo(() => {
    const map = new Map<string, { count: number; total: number }>()
    for (const j of raw) {
      const key = j.tanggal_lunas?.slice(0, 7)
      if (!key) continue
      const prev = map.get(key) ?? { count: 0, total: 0 }
      map.set(key, { count: prev.count + 1, total: prev.total + j.harga })
    }
    return monthList.map(({ year, month, label }) => {
      const key = `${year}-${String(month + 1).padStart(2, '0')}`
      const m = map.get(key) ?? { count: 0, total: 0 }
      return { year, month, label, count: m.count, total: m.total }
    })
  }, [raw, monthList])

  const maxTotal = Math.max(...monthly.map((d) => d.total), 1)
  const totalAll = monthly.reduce((s, d) => s + d.total, 0)
  const activeMonths = monthly.filter((d) => d.count > 0).length
  const avgMonthVal = activeMonths > 0 ? Math.round(totalAll / activeMonths) : 0
  const best = monthly.reduce((a, b) => (a.total >= b.total ? a : b), monthly[0])
  const totalJobs = monthly.reduce((s, d) => s + d.count, 0)

  const pctChange = prevTotal > 0
    ? ((totalAll - prevTotal) / prevTotal * 100).toFixed(1)
    : null

  // ─── Distribusi per jenis_edit ──────────────────────
  const dist = useMemo(() => {
    const map = new Map<string, number>()
    for (const j of raw) {
      map.set(j.jenis_edit, (map.get(j.jenis_edit) ?? 0) + j.harga)
    }
    const total = Array.from(map.values()).reduce((s, v) => s + v, 0) || 1
    return Array.from(map.entries())
      .map(([label, value]) => ({ label, value, pct: (value / total) * 100 }))
      .sort((a, b) => b.value - a.value)
  }, [raw])

  const distColors: Record<string, string> = {
    'Kolase Sudah Pilih': '#f59e0b',
    'Kolase Belum Pilih': '#10b981',
    'Edit Full': '#3b82f6',
  }
  const distBgColors: Record<string, string> = {
    'Kolase Sudah Pilih': 'bg-amber-500',
    'Kolase Belum Pilih': 'bg-emerald-500',
    'Edit Full': 'bg-blue-500',
  }

  let cumulative = 0
  const normalizedStops = dist.map((d) => {
    const color = distColors[d.label] ?? '#94a3b8'
    const start = cumulative
    cumulative += d.pct
    return `${color} ${start}% ${cumulative}%`
  }).join(', ')

  // ─── Top Vendors ────────────────────────────────────
  const topVendors = useMemo(() => {
    const map = new Map<string, number>()
    for (const j of raw) {
      const name = j.vendor?.nama ?? 'Tanpa Vendor'
      map.set(name, (map.get(name) ?? 0) + j.harga)
    }
    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5)
  }, [raw])

  // ─── Export CSV ────────────────────────────────────
  function exportCSV() {
    const header = 'Bulan,Job Lunas,Penghasilan'
    const rows = monthly.map((d) => `${d.label},${d.count},${d.total}`)
    const csv = [header, ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `laporan-${dateStr(fromYear, fromMonth)}-${dateStr(toYear, toMonth)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  // ─── MoM helper ─────────────────────────────────────
  function momChange(i: number): { pct: string; up: boolean } | null {
    if (i === 0) return null
    const prev = monthly[i - 1].total
    if (prev === 0) return monthly[i].total > 0 ? null : null
    const diff = ((monthly[i].total - prev) / prev) * 100
    return { pct: `${diff >= 0 ? '+' : ''}${diff.toFixed(1)}%`, up: diff >= 0 }
  }

  const yLabels = [0, 25, 50, 75, 100].map((pct) => Math.round((maxTotal * pct) / 100))

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-6">
      {/* ── Header ─────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-rose-600" />
          <h1 className="text-2xl font-bold text-slate-800">Laporan Penghasilan</h1>
        </div>
        <button
          onClick={exportCSV}
          disabled={totalAll === 0}
          className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-rose-600 border border-slate-300 hover:border-rose-300 rounded-lg px-3 py-1.5 font-medium transition-colors disabled:opacity-40"
        >
          <Download className="w-3.5 h-3.5" /> CSV
        </button>
      </div>

      {/* ── Filter ─────────────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 md:p-5">
        <label className="block text-xs font-medium text-slate-500 mb-2">Periode</label>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex gap-1">
            <select value={fromMonth} onChange={(e) => setFromMonth(Number(e.target.value))}
              className="border border-slate-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500">
              {MONTHS.map((m, i) => <option key={i} value={i}>{m}</option>)}
            </select>
            <select value={fromYear} onChange={(e) => setFromYear(Number(e.target.value))}
              className="border border-slate-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500">
              {years.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <span className="text-slate-400 text-sm">—</span>
          <div className="flex gap-1">
            <select value={toMonth} onChange={(e) => setToMonth(Number(e.target.value))}
              className="border border-slate-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500">
              {MONTHS.map((m, i) => <option key={i} value={i}>{m}</option>)}
            </select>
            <select value={toYear} onChange={(e) => setToYear(Number(e.target.value))}
              className="border border-slate-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500">
              {years.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          {monthCount > 0 && (
            <span className="text-xs text-slate-400 ml-1">({monthCount} bulan)</span>
          )}
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg px-4 py-3">{error}</div>
      )}

      {/* ── Loading ────────────────────────────── */}
      {loading ? (
        <div className="flex items-center justify-center h-96">
          <div className="animate-spin rounded-full h-10 w-10 border-4 border-rose-500 border-t-transparent" />
        </div>
      ) : (
        <>
          {/* ── Hero ────────────────────────────── */}
          {totalAll > 0 && (
            <div className="bg-gradient-to-br from-rose-50 via-white to-rose-50 rounded-2xl border border-rose-100 shadow-sm p-6 md:p-8 text-center">
              <p className="text-sm font-medium text-slate-500 mb-1">
                {monthList[0]?.label} — {monthList[monthList.length - 1]?.label}
              </p>
              <p className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-rose-600 to-rose-400 bg-clip-text text-transparent">
                {rupiah(totalAll)}
              </p>
              <p className="text-sm text-slate-400 mt-1">Total Penghasilan</p>
              {pctChange !== null && (
                <div className={`inline-flex items-center gap-1 mt-3 text-sm font-medium px-3 py-1 rounded-full ${
                  Number(pctChange) >= 0
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-red-100 text-red-700'
                }`}>
                  <span>{Number(pctChange) >= 0 ? '↑' : '↓'}</span>
                  <span>{Math.abs(Number(pctChange))}% dari periode sebelumnya</span>
                </div>
              )}
            </div>
          )}

          {/* ── KPI Cards ───────────────────────── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
              <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-1">
                <TrendingUp className="w-3.5 h-3.5 text-emerald-500" /> Rata-rata
              </div>
              <p className="text-lg font-bold text-slate-800">{rupiah(avgMonthVal)}</p>
              <p className="text-xs text-slate-400">per bulan aktif</p>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
              <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-1">
                <Award className="w-3.5 h-3.5 text-amber-500" /> Tertinggi
              </div>
              <p className="text-lg font-bold text-slate-800 truncate">{best?.label ?? '-'}</p>
              <p className="text-xs text-slate-400">{best?.total ? rupiah(best.total) : ''}</p>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
              <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-1">
                <Briefcase className="w-3.5 h-3.5 text-blue-500" /> Job Lunas
              </div>
              <p className="text-lg font-bold text-slate-800">{totalJobs}</p>
              <p className="text-xs text-slate-400">{monthCount > 0 ? `${(totalJobs / monthCount).toFixed(1)}/bulan` : ''}</p>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
              <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-1">
                <Calendar className="w-3.5 h-3.5 text-rose-500" /> Bulan Aktif
              </div>
              <p className="text-lg font-bold text-slate-800">{activeMonths} / {monthCount}</p>
              <p className="text-xs text-slate-400">{monthCount > 0 ? `${Math.round((activeMonths / monthCount) * 100)}%` : ''}</p>
            </div>
          </div>

          {/* ── Bar Chart ───────────────────────── */}
          {totalAll > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
              <h2 className="text-sm font-semibold text-slate-700 mb-4">Grafik Penghasilan Per Bulan</h2>
              <div className="flex gap-2">
                {/* Y-axis */}
                <div className="flex flex-col justify-between text-xs text-slate-400 pr-2 shrink-0" style={{ height: 200 }}>
                  {yLabels.slice().reverse().map((v) => (
                    <span key={v} className="leading-none">{v >= 1000 ? `${(v / 1000).toFixed(0)}jt` : `${(v / 1000).toFixed(1)}jt`}</span>
                  ))}
                </div>
                {/* Chart */}
                <div className="flex-1 relative" style={{ height: 200 }}>
                  {/* Grid lines */}
                  <div className="absolute inset-0 flex flex-col justify-between">
                    {yLabels.map((_, i) => (
                      <div key={i} className="border-t border-dashed border-slate-200" style={{ height: 0 }} />
                    ))}
                  </div>
                  {/* Bars */}
                  <div className="absolute inset-0 flex items-end gap-0.5">
                    {monthly.map((d) => {
                      const pct = maxTotal > 0 ? (d.total / maxTotal) * 100 : 0
                      return (
                        <div key={d.label} className="flex-1 flex flex-col items-center justify-end h-full group">
                          <span className="text-[10px] text-slate-400 mb-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                            {d.total > 0 ? rupiah(d.total) : ''}
                          </span>
                          <div
                            className={`w-full max-w-[32px] rounded-t transition-all duration-500 ease-out ${
                              d.total === 0
                                ? 'bg-slate-100'
                                : d.total === best?.total && d.total > 0
                                  ? 'bg-gradient-to-t from-rose-600 to-rose-400'
                                  : 'bg-gradient-to-t from-rose-400 to-rose-200'
                            }`}
                            style={{ height: `${Math.max(pct, d.total === 0 ? 2 : 4)}%`, animation: 'growUp 0.6s ease-out' }}
                          />
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
              {/* X-axis */}
              <div className="flex ml-10 mt-1.5">
                {monthly.map((d) => (
                  <div key={d.label} className="flex-1 text-center text-[10px] text-slate-400 truncate">
                    {d.label.split(' ')[0]}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── 2-Column: Donut + Top Vendors ──────── */}
          {totalAll > 0 && (
            <div className="grid md:grid-cols-2 gap-4">
              {/* Donut */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
                <h2 className="text-sm font-semibold text-slate-700 mb-4">Distribusi per Jenis Edit</h2>
                {dist.length === 0 ? (
                  <p className="text-sm text-slate-400 text-center py-6">Tidak ada data</p>
                ) : (
                  <div className="flex items-center gap-6">
                    <div
                      className="w-28 h-28 rounded-full shrink-0"
                      style={{
                        background: dist.length > 0
                          ? `conic-gradient(${normalizedStops})`
                          : '#e2e8f0',
                      }}
                    />
                    <div className="flex-1 space-y-2 min-w-0">
                      {dist.map((d) => (
                        <div key={d.label} className="flex items-center gap-2 text-sm">
                          <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${distBgColors[d.label] ?? 'bg-slate-400'}`} />
                          <span className="text-slate-600 truncate flex-1">{d.label}</span>
                          <span className="text-slate-800 font-medium">{d.pct.toFixed(0)}%</span>
                          <span className="text-slate-400 text-xs w-20 text-right">{rupiah(d.value)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Top Vendors */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
                <h2 className="text-sm font-semibold text-slate-700 mb-4">Vendor Teratas</h2>
                {topVendors.length === 0 ? (
                  <p className="text-sm text-slate-400 text-center py-6">Tidak ada data</p>
                ) : (
                  <div className="space-y-3">
                    {topVendors.map((v, i) => {
                      const barPct = (v.value / totalAll) * 100
                      return (
                        <div key={v.name}>
                          <div className="flex items-center justify-between text-sm mb-1">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0 ${
                                i === 0 ? 'bg-amber-400' : i === 1 ? 'bg-slate-400' : i === 2 ? 'bg-amber-700' : 'bg-slate-300'
                              }`}>{i + 1}</span>
                              <span className="truncate text-slate-700">{v.name}</span>
                            </div>
                            <span className="text-slate-800 font-medium shrink-0 ml-2">{rupiah(v.value)}</span>
                          </div>
                          <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full bg-gradient-to-r from-rose-400 to-rose-500 rounded-full" style={{ width: `${barPct}%` }} />
                          </div>
                        </div>
                      )
                    })}
                    <div className="text-xs text-slate-400 text-right pt-1">
                      Dari {rupiah(totalAll)} total
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Empty State ──────────────────────── */}
          {totalAll === 0 && !loading && (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-16 text-center">
              <BarChart3 className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-500 text-sm">Belum ada penghasilan di periode ini.</p>
              <p className="text-slate-400 text-xs mt-1">Coba ubah rentang periode filter di atas.</p>
            </div>
          )}

          {/* ── Monthly Table ────────────────────── */}
          {monthly.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-slate-700">Rincian Bulanan</h2>
                <span className="text-xs text-slate-400">{monthCount} bulan</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-slate-500 border-b border-slate-100">
                      <th className="px-5 py-3 font-medium">Bulan</th>
                      <th className="px-4 py-3 font-medium text-right">Job</th>
                      <th className="px-4 py-3 font-medium text-right">Pendapatan</th>
                      <th className="px-4 py-3 font-medium text-right">vs Sebelumnya</th>
                      <th className="px-4 py-3 font-medium" style={{ width: '30%' }}>Indikator</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {monthly.map((d, i) => {
                      const mom = momChange(i)
                      const pct = maxTotal > 0 ? (d.total / maxTotal) * 100 : 0
                      return (
                        <tr key={d.label} className="hover:bg-slate-50 transition-colors">
                          <td className="px-5 py-3 font-medium text-slate-700">{d.label}</td>
                          <td className="px-4 py-3 text-right text-slate-600">{d.count}</td>
                          <td className="px-4 py-3 text-right font-medium text-slate-800">
                            {d.total > 0 ? rupiah(d.total) : <span className="text-slate-300">Rp 0</span>}
                          </td>
                          <td className="px-4 py-3 text-right">
                            {mom ? (
                              <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${
                                mom.up ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                              }`}>
                                {mom.pct}
                              </span>
                            ) : (
                              <span className="text-xs text-slate-300">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all duration-500 ${
                                  d.total === 0
                                    ? 'bg-slate-200'
                                    : d.total === best?.total && d.total > 0
                                      ? 'bg-gradient-to-r from-rose-500 to-rose-600'
                                      : 'bg-gradient-to-r from-rose-300 to-rose-500'
                                }`}
                                style={{ width: `${Math.max(pct, d.total === 0 ? 2 : 4)}%` }}
                              />
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-50 border-t-2 border-slate-200">
                      <td className="px-5 py-3 text-sm font-bold text-slate-800">TOTAL</td>
                      <td className="px-4 py-3 text-right text-sm font-bold text-slate-800">{totalJobs}</td>
                      <td className="px-4 py-3 text-right text-sm font-bold text-slate-800">{rupiah(totalAll)}</td>
                      <td className="px-4 py-3" />
                      <td className="px-4 py-3" />
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      <style>{`
        @keyframes growUp {
          from { transform: scaleY(0); }
          to { transform: scaleY(1); }
        }
      `}</style>
    </div>
  )
}
