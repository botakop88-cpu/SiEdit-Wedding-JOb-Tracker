import { useEffect, useState } from 'react'
import { BarChart3, TrendingUp, Award, Calendar } from 'lucide-react'
import { supabase } from '../lib/supabaseClient'
import { rupiah } from '../lib/utils'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']

interface MonthData {
  year: number
  month: number
  label: string
  count: number
  total: number
}

export default function Reports() {
  const now = new Date()
  const curMonth = now.getMonth()
  const curYear = now.getFullYear()

  const [fromMonth, setFromMonth] = useState(curMonth)
  const [fromYear, setFromYear] = useState(curYear - 1)
  const [toMonth, setToMonth] = useState(curMonth)
  const [toYear, setToYear] = useState(curYear)
  const [data, setData] = useState<MonthData[]>([])
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

  useEffect(() => { loadData() }, [fromYear, fromMonth, toYear, toMonth])

  async function loadData() {
    setLoading(true)
    setError('')

    const from = dateStr(fromYear, fromMonth) + '-01'
    const to = monthEnd(toYear, toMonth)

    const { data: raw, error: err } = await supabase
      .from('job')
      .select('harga, tanggal_lunas')
      .is('deleted_at', null)
      .eq('status_bayar', 'Lunas')
      .gte('tanggal_lunas', from)
      .lte('tanggal_lunas', to)
      .order('tanggal_lunas')

    if (err) {
      setError(err.message)
      setLoading(false)
      return
    }

    const map = new Map<string, { count: number; total: number }>()
    for (const j of raw ?? []) {
      const key = j.tanggal_lunas?.slice(0, 7)
      if (!key) continue
      const prev = map.get(key) ?? { count: 0, total: 0 }
      map.set(key, { count: prev.count + 1, total: prev.total + j.harga })
    }

    const months = allMonths().map(({ year, month, label }) => {
      const key = `${year}-${String(month + 1).padStart(2, '0')}`
      const m = map.get(key) ?? { count: 0, total: 0 }
      return { year, month, label, count: m.count, total: m.total }
    })

    setData(months)
    setLoading(false)
  }

  const maxTotal = Math.max(...data.map((d) => d.total), 1)
  const totalAll = data.reduce((s, d) => s + d.total, 0)
  const activeMonths = data.filter((d) => d.count > 0).length
  const avgMonthVal = activeMonths > 0 ? Math.round(totalAll / activeMonths) : 0
  const best = data.reduce((a, b) => (a.total >= b.total ? a : b), data[0])

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-4">
      <div className="flex items-center gap-2">
        <BarChart3 className="w-5 h-5 text-rose-600" />
        <h1 className="text-2xl font-bold text-slate-800">Laporan Penghasilan</h1>
      </div>

      {/* Filter */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Dari</label>
            <div className="flex gap-1">
              <select
                value={fromMonth}
                onChange={(e) => setFromMonth(Number(e.target.value))}
                className="border border-slate-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
              >
                {MONTHS.map((m, i) => <option key={i} value={i}>{m}</option>)}
              </select>
              <select
                value={fromYear}
                onChange={(e) => setFromYear(Number(e.target.value))}
                className="border border-slate-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
              >
                {years.map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Sampai</label>
            <div className="flex gap-1">
              <select
                value={toMonth}
                onChange={(e) => setToMonth(Number(e.target.value))}
                className="border border-slate-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
              >
                {MONTHS.map((m, i) => <option key={i} value={i}>{m}</option>)}
              </select>
              <select
                value={toYear}
                onChange={(e) => setToYear(Number(e.target.value))}
                className="border border-slate-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
              >
                {years.map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 text-sm rounded-lg px-4 py-3">{error}</div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
          <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
            <TrendingUp className="w-4 h-4 text-emerald-500" /> Total
          </div>
          <p className="text-lg font-bold text-slate-800">{rupiah(totalAll)}</p>
          <p className="text-xs text-slate-400">{activeMonths} bulan aktif</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
          <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
            <Calendar className="w-4 h-4 text-blue-500" /> Rata-rata
          </div>
          <p className="text-lg font-bold text-slate-800">{rupiah(avgMonthVal)}</p>
          <p className="text-xs text-slate-400">per bulan aktif</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
          <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
            <Award className="w-4 h-4 text-amber-500" /> Tertinggi
          </div>
          <p className="text-lg font-bold text-slate-800">{best?.label ? `${best.label}` : '-'}</p>
          <p className="text-xs text-slate-400">{best?.total ? rupiah(best.total) : ''}</p>
        </div>
      </div>

      {/* Loading */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-4 border-rose-500 border-t-transparent" />
        </div>
      ) : totalAll === 0 && data.length > 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-12 text-center">
          <BarChart3 className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 text-sm">Belum ada penghasilan di periode ini.</p>
        </div>
      ) : (
        /* Table */
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100">
            <h2 className="text-sm font-semibold text-slate-700">Rincian Per Bulan</h2>
          </div>
          <div className="divide-y divide-slate-50">
            {data.map((d) => {
              const pct = maxTotal > 0 ? (d.total / maxTotal) * 100 : 0
              return (
                <div key={d.label} className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50">
                  <div className="w-20 shrink-0 text-sm font-medium text-slate-600">
                    {d.label}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="h-5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          d.total === 0
                            ? 'bg-slate-200'
                            : d.total === best?.total && d.total > 0
                              ? 'bg-gradient-to-r from-rose-400 to-rose-600'
                              : 'bg-gradient-to-r from-rose-300 to-rose-500'
                        }`}
                        style={{ width: `${Math.max(pct, d.total === 0 ? 2 : 4)}%` }}
                      />
                    </div>
                  </div>
                  <div className="w-12 shrink-0 text-right text-xs text-slate-400">
                    {d.count} job
                  </div>
                  <div className="w-28 shrink-0 text-right text-sm font-medium text-slate-800">
                    {rupiah(d.total)}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
