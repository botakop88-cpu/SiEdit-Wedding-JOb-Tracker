import { useEffect, useState, useMemo } from 'react'
import { BarChart3, TrendingUp, Award, Briefcase, Calendar, Download } from 'lucide-react'
import { supabase } from '../lib/supabaseClient'
import { rupiah } from '../lib/utils'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']

interface RawJob {
  nama_project: string
  harga: number
  tanggal_lunas: string | null
  deadline: string | null
  jenis_edit: string
  status_edit: string
  status_bayar: string
  status_cetak: string
  catatan: string | null
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

    const prevEnd = { year: fromYear, month: fromMonth - 1 }
    if (prevEnd.month < 0) { prevEnd.month = 11; prevEnd.year-- }
    const prevStart = { year: prevEnd.year, month: prevEnd.month - (monthCount - 1) }
    if (prevStart.month < 0) { prevStart.month += 12; prevStart.year-- }

    const [mainRes, prevRes] = await Promise.all([
      supabase
        .from('job')
        .select('nama_project, harga, tanggal_lunas, deadline, jenis_edit, status_edit, status_bayar, status_cetak, catatan, vendor:vendor_id(nama)')
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
  function fmtCSV(v: string | number | null | undefined) {
    if (v === null || v === undefined || v === '') return '-'
    return String(v)
  }

  function fmtHarga(v: number) {
    return 'Rp' + v.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  }

  function fmtDate(v: string | null | undefined) {
    if (!v) return '-'
    return v
  }

  function csvEscape(val: string): string {
    if (val.includes(',') || val.includes('"') || val.includes('\n') || val.includes('\r')) {
      return '"' + val.replace(/"/g, '""') + '"'
    }
    return val
  }

  function dataExportCSV() {
    const cols = ['Project','Vendor','Jenis Edit','Harga','Deadline','Status Edit','Status Bayar','Status Cetak','Tanggal Lunas','Catatan']
    const header = cols.join(',')

    const rows = raw.map((j) => {
      const vals = [
        csvEscape(j.nama_project),
        csvEscape(j.vendor?.nama ?? '-'),
        csvEscape(j.jenis_edit),
        csvEscape(fmtHarga(j.harga)),
        csvEscape(fmtDate(j.deadline)),
        csvEscape(j.status_edit),
        csvEscape(j.status_bayar),
        csvEscape(j.status_cetak),
        csvEscape(fmtDate(j.tanggal_lunas)),
        csvEscape(fmtCSV(j.catatan)),
      ]
      return vals.join(',')
    })

    const csv = '\uFEFF' + [header, ...rows].join('\r\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `data-lunas-siedit-${dateStr(fromYear, fromMonth)}-${dateStr(toYear, toMonth)}.csv`
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

  const hasData = totalAll > 0

  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto space-y-5">
      {/* ── Filter ─────────────────────────────── */}
      <div className="border border-slate-200 rounded-xl bg-white shadow-sm p-4">
        <div className="flex flex-wrap items-center gap-2">
          <select value={fromMonth} onChange={(e) => setFromMonth(Number(e.target.value))}
            className="border border-slate-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500">
            {MONTHS.map((m, i) => <option key={i} value={i}>{m}</option>)}
          </select>
          <select value={fromYear} onChange={(e) => setFromYear(Number(e.target.value))}
            className="border border-slate-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500">
            {years.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
          <span className="text-slate-400 text-sm">—</span>
          <select value={toMonth} onChange={(e) => setToMonth(Number(e.target.value))}
            className="border border-slate-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500">
            {MONTHS.map((m, i) => <option key={i} value={i}>{m}</option>)}
          </select>
          <select value={toYear} onChange={(e) => setToYear(Number(e.target.value))}
            className="border border-slate-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500">
            {years.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
          <button onClick={dataExportCSV} disabled={!hasData}
            className="ml-auto flex items-center gap-1 text-xs text-slate-400 hover:text-rose-600 border border-slate-200 hover:border-rose-300 rounded-lg px-2.5 py-1.5 font-medium transition-colors disabled:opacity-40">
            <Download className="w-3.5 h-3.5" /> CSV
          </button>
        </div>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg px-4 py-3">{error}</div>}

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-3 border-rose-500 border-t-transparent" />
        </div>
      ) : !hasData ? (
        <div className="border border-slate-200 rounded-xl bg-white shadow-sm p-12 text-center">
          <BarChart3 className="w-10 h-10 text-slate-200 mx-auto mb-3" />
          <p className="text-slate-500 text-sm">Belum ada penghasilan di periode ini.</p>
        </div>
      ) : (
        <>
          {/* ── Summary Box ──────────────────────── */}
          <div className="border border-slate-200 rounded-xl bg-white shadow-sm overflow-hidden">
            <div className="bg-rose-50 px-5 py-3 border-b border-slate-200">
              <h2 className="font-bold text-slate-800 flex items-center gap-2">
                📈 Laporan Penghasilan SiEdit
              </h2>
            </div>
            <div className="px-5 py-4 space-y-2 text-sm">
              <p className="flex items-center gap-2"><span className="w-5">💰</span> Penghasilan : <strong className="text-rose-600">{rupiah(totalAll)}</strong></p>
              <p className="flex items-center gap-2"><span className="w-5">✅</span> Job Lunas   : <strong>{totalJobs}</strong></p>
              <p className="flex items-center gap-2"><span className="w-5">📅</span> Periode     : {monthList[0]?.label} — {monthList[monthList.length - 1]?.label}</p>
              {pctChange !== null && (
                <p className="flex items-center gap-2 text-xs text-slate-400 ml-7">
                  <span>{Number(pctChange) >= 0 ? '↑' : '↓'} {Math.abs(Number(pctChange))}% dari periode sebelumnya</span>
                </p>
              )}
            </div>
          </div>

          {/* ── KPI Cards ───────────────────────── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 relative overflow-hidden">
              <div className="absolute -right-3 -top-3 w-16 h-16 rounded-full bg-emerald-50" />
              <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-1">
                <TrendingUp className="w-3.5 h-3.5 text-emerald-500" /> Rata-rata
              </div>
              <p className="text-lg font-bold text-slate-800">{rupiah(avgMonthVal)}</p>
              <p className="text-xs text-slate-400">per bulan aktif</p>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 relative overflow-hidden">
              <div className="absolute -right-3 -top-3 w-16 h-16 rounded-full bg-amber-50" />
              <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-1">
                <Award className="w-3.5 h-3.5 text-amber-500" /> Tertinggi
              </div>
              <p className="text-lg font-bold text-slate-800 truncate">{best?.label ?? '-'}</p>
              <p className="text-xs text-slate-400">{best?.total ? rupiah(best.total) : ''}</p>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 relative overflow-hidden">
              <div className="absolute -right-3 -top-3 w-16 h-16 rounded-full bg-blue-50" />
              <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-1">
                <Briefcase className="w-3.5 h-3.5 text-blue-500" /> Job Lunas
              </div>
              <p className="text-lg font-bold text-slate-800">{totalJobs}</p>
              <p className="text-xs text-slate-400">{monthCount > 0 ? `${(totalJobs / monthCount).toFixed(1)}/bulan` : ''}</p>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 relative overflow-hidden">
              <div className="absolute -right-3 -top-3 w-16 h-16 rounded-full bg-rose-50" />
              <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-1">
                <Calendar className="w-3.5 h-3.5 text-rose-500" /> Bulan Aktif
              </div>
              <p className="text-lg font-bold text-slate-800">{activeMonths} / {monthCount}</p>
              <p className="text-xs text-slate-400">{monthCount > 0 ? `${Math.round((activeMonths / monthCount) * 100)}%` : ''}</p>
            </div>
          </div>

          {/* ── Bar Chart ───────────────────────── */}
          <div className="border border-slate-200 rounded-xl bg-white shadow-sm p-5">
            <h3 className="text-sm font-semibold text-slate-700 mb-4">📊 Grafik Pendapatan Bulanan</h3>
            <div className="flex gap-2">
              <div className="flex flex-col justify-between text-xs text-slate-400 pr-2 shrink-0" style={{ height: 200 }}>
                {[0, 25, 50, 75, 100].reverse().map((pct) => {
                  const v = Math.round((maxTotal * pct) / 100)
                  return (
                    <span key={pct} className="leading-none">
                      {v >= 1_000_000 ? `Rp${(v / 1_000_000).toFixed(1)}jt` : v >= 1_000 ? `Rp${(v / 1_000).toFixed(0)}rb` : `Rp${v}`}
                    </span>
                  )
                })}
              </div>
              <div className="flex-1 relative" style={{ height: 200 }}>
                <div className="absolute inset-0 flex flex-col justify-between">
                  {[0, 1, 2, 3, 4].map((i) => (
                    <div key={i} className="border-t border-dashed border-slate-200" style={{ height: 0 }} />
                  ))}
                </div>
                <div className="absolute inset-0 flex items-end gap-1">
                  {monthly.map((d) => {
                    const pct = maxTotal > 0 ? (d.total / maxTotal) * 100 : 0
                    const isBest = d.total === best?.total && d.total > 0
                    return (
                      <div key={d.label} className="flex-1 flex flex-col items-center justify-end h-full group relative">
                        <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-[10px] text-slate-500 font-medium whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity bg-white px-1.5 py-0.5 rounded border border-slate-200 shadow-sm z-10">
                          {rupiah(d.total)}
                        </div>
                        <div
                          className={`w-full max-w-[36px] rounded-t transition-all duration-500 ease-out ${
                            d.total === 0
                              ? 'bg-slate-100'
                              : isBest
                                ? 'bg-gradient-to-t from-rose-600 via-rose-400 to-rose-300'
                                : 'bg-gradient-to-t from-rose-400 to-rose-200'
                          }`}
                          style={{
                            height: `${Math.max(pct, d.total === 0 ? 2 : 4)}%`,
                            animation: 'growUp 0.6s ease-out',
                          }}
                        />
                        {isBest && d.total > 0 && (
                          <span className="text-[9px] text-rose-500 font-bold mt-0.5">★</span>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
            <div className="flex ml-8 mt-1.5">
              {monthly.map((d) => (
                <div key={d.label} className="flex-1 text-center text-[10px] text-slate-400 truncate">
                  {d.label.split(' ')[0]}
                </div>
              ))}
            </div>
            <style>{`
              @keyframes growUp {
                from { transform: scaleY(0); }
                to { transform: scaleY(1); }
              }
            `}</style>
          </div>

          {/* ── 2-Column: Donut + Top Vendors ──────── */}
          <div className="grid md:grid-cols-2 gap-4">
            {/* Donut */}
            <div className="border border-slate-200 rounded-xl bg-white shadow-sm p-5">
              <h3 className="text-sm font-semibold text-slate-700 mb-3">📁 Distribusi per Jenis Edit</h3>
              {dist.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-6">Tidak ada data</p>
              ) : (
                <div className="flex flex-col items-center gap-4">
                  <div className="relative w-28 h-28">
                    <div
                      className="w-28 h-28 rounded-full"
                      style={{ background: `conic-gradient(${normalizedStops})` }}
                    />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-14 h-14 rounded-full bg-white flex items-center justify-center">
                        <span className="text-lg font-bold text-slate-600">{totalJobs}</span>
                      </div>
                    </div>
                  </div>
                  <div className="w-full space-y-2">
                    {dist.map((d) => (
                      <div key={d.label}>
                        <div className="flex items-center justify-between text-sm mb-0.5">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${distBgColors[d.label] ?? 'bg-slate-400'}`} />
                            <span className="text-slate-600 truncate">{d.label}</span>
                          </div>
                          <span className="font-medium text-slate-800 shrink-0 ml-2">{d.pct.toFixed(0)}%</span>
                        </div>
                        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${distBgColors[d.label] ?? 'bg-slate-400'}`}
                            style={{ width: `${d.pct}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Top Vendors */}
            <div className="border border-slate-200 rounded-xl bg-white shadow-sm p-5">
              <h3 className="text-sm font-semibold text-slate-700 mb-3">🏆 Top Vendor</h3>
              {topVendors.length === 0 ? (
                <p className="text-sm text-slate-400">Tidak ada data</p>
              ) : (
                <div className="space-y-3">
                  {topVendors.map((v, i) => {
                    const pct = (v.value / totalAll) * 100
                    return (
                      <div key={v.name}>
                        <div className="flex items-center justify-between text-sm mb-1">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0 ${
                              i === 0 ? 'bg-amber-400' : i === 1 ? 'bg-slate-400' : i === 2 ? 'bg-amber-700' : 'bg-slate-300'
                            }`}>{i + 1}</span>
                            <span className="text-slate-700 truncate font-medium">{v.name}</span>
                          </div>
                          <span className="text-slate-800 font-medium shrink-0 ml-2">{rupiah(v.value)}</span>
                        </div>
                        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-rose-300 to-rose-500 transition-all duration-500"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    )
                  })}
                  <div className="text-[10px] text-slate-400 text-right pt-0.5">
                    Dari {rupiah(totalAll)} total
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ── Monthly Table ────────────────────── */}
          {monthly.length > 0 && (
            <div className="border border-slate-200 rounded-xl bg-white shadow-sm overflow-hidden">
              <div className="px-5 py-3 border-b border-slate-200">
                <h3 className="text-sm font-semibold text-slate-700">📋 Rincian Bulanan</h3>
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
    </div>
  )
}
