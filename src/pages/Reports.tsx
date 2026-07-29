import { useEffect, useState, useMemo } from 'react'
import { BarChart3, Download } from 'lucide-react'
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
    const mainRes = await supabase
      .from('job')
      .select('nama_project, harga, tanggal_lunas, deadline, jenis_edit, status_edit, status_bayar, status_cetak, catatan, vendor:vendor_id(nama)')
      .is('deleted_at', null)
      .eq('status_bayar', 'Lunas')
      .gte('tanggal_lunas', from)
      .lte('tanggal_lunas', to)
      .order('tanggal_lunas')

    if (mainRes.error) {
      setError(mainRes.error.message)
      setLoading(false)
      return
    }

    setRaw((mainRes.data ?? []) as unknown as RawJob[])
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
  const totalJobs = monthly.reduce((s, d) => s + d.count, 0)

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



  const hasData = totalAll > 0

  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto space-y-5">
      {/* ── Filter ─────────────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
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
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-12 text-center">
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
            </div>
          </div>

          {/* ── Bar Chart ───────────────────────── */}
          <div className="border border-slate-200 rounded-xl bg-white shadow-sm p-5">
            <h3 className="text-sm font-semibold text-slate-700 mb-3">📊 Grafik Pendapatan Bulanan</h3>
            <div className="space-y-1.5">
              {[...monthly].reverse().map((d) => {
                const pct = maxTotal > 0 ? (d.total / maxTotal) * 100 : 0
                return (
                  <div key={d.label} className="flex items-center gap-2">
                    <span className="text-xs text-slate-500 w-20 shrink-0 text-right">{d.label}</span>
                    <div className="flex-1 h-5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full bg-rose-400 transition-all duration-500"
                        style={{ width: `${Math.max(pct, d.total === 0 ? 0 : 1)}%` }}
                      />
                    </div>
                    <span className="text-xs font-medium text-slate-700 w-24 shrink-0 text-right">{rupiah(d.total)}</span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* ── 2-Column: Top Vendors + Jenis Edit ──── */}
          <div className="grid md:grid-cols-2 gap-4">
            {/* Top Vendors */}
            <div className="border border-slate-200 rounded-xl bg-white shadow-sm p-5">
              <h3 className="text-sm font-semibold text-slate-700 mb-3">🏆 Top Vendor</h3>
              {topVendors.length === 0 ? (
                <p className="text-sm text-slate-400">Tidak ada data</p>
              ) : (
                <div className="space-y-2">
                  {topVendors.map((v, i) => {
                    const pct = (v.value / totalAll) * 100
                    return (
                      <div key={v.name}>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-slate-600">{i + 1}. {v.name}</span>
                          <span className="font-medium text-slate-800">{rupiah(v.value)}</span>
                        </div>
                        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden mt-0.5">
                          <div className="h-full bg-rose-300 rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Jenis Edit */}
            <div className="border border-slate-200 rounded-xl bg-white shadow-sm p-5">
              <h3 className="text-sm font-semibold text-slate-700 mb-3">📁 Jenis Edit</h3>
              {dist.length === 0 ? (
                <p className="text-sm text-slate-400">Tidak ada data</p>
              ) : (
                <div className="space-y-2">
                  {dist.map((d) => (
                    <div key={d.label} className="flex items-center justify-between text-sm">
                      <span className="text-slate-600">• {d.label}</span>
                      <span className="font-medium text-slate-800">({d.pct.toFixed(0)}%)</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
