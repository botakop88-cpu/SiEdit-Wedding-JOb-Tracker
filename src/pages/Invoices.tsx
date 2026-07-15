import { useEffect, useState } from 'react'
import { Plus, Printer, Trash2, History } from 'lucide-react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../lib/AuthContext'
import type { Vendor, Job, Invoice, InvoiceItem } from '../lib/types'
import { rupiah, formatDate, todayStr } from '../lib/utils'

export default function Invoices() {
  const { user } = useAuth()
  const [tab, setTab] = useState<'buat' | 'riwayat'>('buat')
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [selectedVendor, setSelectedVendor] = useState('')
  const [unpaidJobs, setUnpaidJobs] = useState<Job[]>([])
  const [checked, setChecked] = useState<Set<string>>(new Set())
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  // Pagination for riwayat
  const [riwayatPage, setRiwayatPage] = useState(0)
  const [riwayatHasMore, setRiwayatHasMore] = useState(true)
  const [riwayatLoading, setRiwayatLoading] = useState(false)
  const RIWAYAT_PAGE_SIZE = 20

  useEffect(() => { loadInitial() }, [])

  async function loadInitial() {
    setLoading(true)
    const [vRes, iRes] = await Promise.all([
      supabase.from('vendor').select('*').is('deleted_at', null).order('nama'),
      // First page of riwayat only
      supabase.from('invoice').select('*').is('deleted_at', null).order('created_at', { ascending: false })
        .range(0, RIWAYAT_PAGE_SIZE - 1),
    ])
    if (vRes.data) setVendors(vRes.data as Vendor[])
    if (iRes.data) {
      setInvoices(iRes.data as Invoice[])
      setRiwayatHasMore((iRes.data?.length ?? 0) === RIWAYAT_PAGE_SIZE)
    }
    setRiwayatPage(1)
    setLoading(false)
  }

  async function loadMoreRiwayat() {
    setRiwayatLoading(true)
    const from = riwayatPage * RIWAYAT_PAGE_SIZE
    const to = from + RIWAYAT_PAGE_SIZE - 1
    const { data } = await supabase
      .from('invoice')
      .select('*')
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .range(from, to)
    if (data) {
      const newList = data as Invoice[]
      const isFull = newList.length === RIWAYAT_PAGE_SIZE
      setInvoices((prev) => [...prev, ...newList])
      setRiwayatHasMore(isFull)
      if (isFull) setRiwayatPage((p) => p + 1)
    }
    setRiwayatLoading(false)
  }

  async function loadUnpaid(vendorId: string) {
    setSelectedVendor(vendorId)
    if (!vendorId) {
      setUnpaidJobs([])
      setChecked(new Set())
      return
    }
    const { data } = await supabase
      .from('job')
      .select('*')
      .eq('vendor_id', vendorId)
      .eq('status_bayar', 'Belum Bayar')
      .is('deleted_at', null)
      .order('created_at')

    const jobs = (data ?? []) as Job[]
    setUnpaidJobs(jobs)
    setChecked(new Set(jobs.map((j) => j.id)))
  }

  function toggleJob(id: string) {
    setChecked((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const selectedJobs = unpaidJobs.filter((j) => checked.has(j.id))
  const total = selectedJobs.reduce((s, j) => s + j.harga, 0)

  async function generateInvoice() {
    if (selectedJobs.length === 0) return alert('Pilih minimal 1 job.')
    setGenerating(true)

    const vendor = vendors.find((v) => v.id === selectedVendor)
    const items: InvoiceItem[] = selectedJobs.map((j) => ({
      job_id: j.id,
      nama_project: j.nama_project,
      harga: j.harga,
      jenis: j.jenis_edit,
    }))

    // Invoice number from count
    const { count } = await supabase
      .from('invoice')
      .select('*', { count: 'exact', head: true })

    const invNumber = `INV-${String((count ?? 0) + 1).padStart(4, '0')}`

    const { error } = await supabase.from('invoice').insert({
      user_id: user!.id,
      vendor_id: selectedVendor,
      vendor_nama: vendor?.nama ?? '',
      tanggal: todayStr(),
      items_json: JSON.stringify(items),
      total,
      status_bayar: 'Belum Bayar',
    })

    if (error) {
      alert('Gagal membuat invoice: ' + error.message)
      setGenerating(false)
      return
    }

    // Print
    printInvoice(invNumber, vendor?.nama ?? '', todayStr(), items, total)

    setSelectedVendor('')
    setUnpaidJobs([])
    setChecked(new Set())
    setTab('riwayat')
    await loadInitial()
    setGenerating(false)
  }
  function printInvoice(
    number: string,
    vendorNama: string,
    tanggal: string,
    items: InvoiceItem[],
    totalAmount: number,
  ) {
    const rows = items
      .map(
        (it, i) =>
          `<tr>
            <td style="padding:8px;border-bottom:1px solid #e2e8f0">${i + 1}</td>
            <td style="padding:8px;border-bottom:1px solid #e2e8f0">${it.nama_project}</td>
            <td style="padding:8px;border-bottom:1px solid #e2e8f0">${it.jenis}</td>
            <td style="padding:8px;border-bottom:1px solid #e2e8f0;text-align:right">${rupiah(it.harga)}</td>
          </tr>`,
      )
      .join('')

    const html = `<!DOCTYPE html><html><head><title>${number}</title>
      <style>
        body{font-family:system-ui,sans-serif;max-width:700px;margin:40px auto;color:#1e293b}
        h1{font-size:28px;margin:0 0 4px;letter-spacing:2px}
        .meta{color:#64748b;font-size:14px;margin-bottom:24px}
        table{width:100%;border-collapse:collapse;font-size:14px}
        th{text-align:left;padding:8px;border-bottom:2px solid #1e293b;font-size:12px;text-transform:uppercase;color:#64748b}
        .total{text-align:right;font-size:18px;font-weight:700;margin-top:16px}
      </style></head><body>
        <h1>INVOICE</h1>
        <div class="meta">
          <div><strong>${number}</strong></div>
          <div>Kepada: ${vendorNama}</div>
          <div>Tanggal: ${formatDate(tanggal)}</div>
        </div>
        <table>
          <thead><tr><th>No</th><th>Project</th><th>Jenis</th><th style="text-align:right">Harga</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
        <div class="total">Total: ${rupiah(totalAmount)}</div>
        <script>window.onload=function(){window.print()}</script>
      </body></html>`

    const win = window.open('', '_blank')
    if (win) {
      win.document.write(html)
      win.document.close()
    }
  }

  async function toggleStatus(inv: Invoice) {
    const newStatus = inv.status_bayar === 'Lunas' ? 'Belum Bayar' : 'Lunas'
    const items: InvoiceItem[] = JSON.parse(inv.items_json)
    const jobIds = items.map((i) => i.job_id)

    const { error: invErr } = await supabase
      .from('invoice')
      .update({ status_bayar: newStatus })
      .eq('id', inv.id)

    if (invErr) return alert('Gagal update invoice: ' + invErr.message)

    // Sync jobs by ID (reliable - no name collision)
    const jobUpdate: Record<string, unknown> = {
      status_bayar: newStatus,
      updated_at: new Date().toISOString(),
    }
    if (newStatus === 'Lunas') jobUpdate.tanggal_lunas = todayStr()
    else jobUpdate.tanggal_lunas = null

    const { error: jobErr } = await supabase
      .from('job')
      .update(jobUpdate)
      .in('id', jobIds)
      .is('deleted_at', null)

    if (jobErr) alert('Invoice diupdate, tapi gagal sync job: ' + jobErr.message)

    await loadInitial()
  }

  async function softDelete(id: string) {
    if (!confirm('Hapus invoice ini?')) return
    const { error } = await supabase
      .from('invoice')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', user!.id)
    if (error) {
      alert('Gagal hapus: ' + error.message)
      return
    }
    await loadInitial()
  }

  async function reprint(inv: Invoice) {
    const items: InvoiceItem[] = JSON.parse(inv.items_json)
    // invoice number from DB counter
    const { count } = await supabase
      .from('invoice')
      .select('*', { count: 'exact', head: true })
      .lte('created_at', inv.created_at)
    const number = `INV-${String((count ?? 1)).padStart(4, '0')}`
    printInvoice(number, inv.vendor_nama, inv.tanggal, items, inv.total)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-4 border-rose-500 border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Invoice</h1>
        <p className="text-sm text-slate-500">Buat dan kelola invoice per vendor</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 rounded-lg p-1 w-fit">
        <button
          onClick={() => setTab('buat')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium transition-colors ${tab === 'buat' ? 'bg-white shadow text-slate-800' : 'text-slate-500'}`}
        >
          <Plus className="w-4 h-4" /> Buat Invoice
        </button>
        <button
          onClick={() => setTab('riwayat')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium transition-colors ${tab === 'riwayat' ? 'bg-white shadow text-slate-800' : 'text-slate-500'}`}
        >
          <History className="w-4 h-4" /> Riwayat
        </button>
      </div>

      {tab === 'buat' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Pilih Vendor</label>
            <select
              value={selectedVendor}
              onChange={(e) => loadUnpaid(e.target.value)}
              className="w-full sm:w-80 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
            >
              <option value="">-- Pilih vendor --</option>
              {vendors.map((v) => (
                <option key={v.id} value={v.id}>{v.nama}</option>
              ))}
            </select>
          </div>

          {selectedVendor && unpaidJobs.length === 0 && (
            <p className="text-sm text-slate-400 py-4 text-center">Tidak ada job belum bayar untuk vendor ini.</p>
          )}

          {unpaidJobs.length > 0 && (
            <>
              <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg overflow-hidden">
                {unpaidJobs.map((j) => (
                  <label key={j.id} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={checked.has(j.id)}
                      onChange={() => toggleJob(j.id)}
                      className="w-4 h-4 rounded accent-rose-600"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">{j.nama_project}</p>
                      <p className="text-xs text-slate-400">{j.jenis_edit}</p>
                    </div>
                    <span className="text-sm font-medium text-slate-700 shrink-0">{rupiah(j.harga)}</span>
                  </label>
                ))}
              </div>

              <div className="flex items-center justify-between pt-2">
                <div>
                  <p className="text-xs text-slate-400">{selectedJobs.length} item dipilih</p>
                  <p className="text-lg font-bold text-slate-800">{rupiah(total)}</p>
                </div>
                <button
                  onClick={generateInvoice}
                  disabled={generating || selectedJobs.length === 0}
                  className="flex items-center gap-1.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-60 text-white text-sm font-medium px-5 py-2.5 rounded-lg transition-colors"
                >
                  <Printer className="w-4 h-4" />
                  {generating ? 'Membuat...' : 'Buat & Cetak Invoice'}
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {tab === 'riwayat' && (
        <div className="space-y-3">
          {invoices.length === 0 ? (
            <p className="text-center py-16 text-slate-400 text-sm">Belum ada invoice.</p>
          ) : (
            <>
              {invoices.map((inv) => {
                const items: InvoiceItem[] = JSON.parse(inv.items_json)
                return (
                  <div key={inv.id} className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-sm text-slate-800">{inv.vendor_nama}</h3>
                        <button
                          onClick={() => toggleStatus(inv)}
                          className={`text-xs px-2 py-0.5 rounded-full font-medium cursor-pointer ${
                            inv.status_bayar === 'Lunas'
                              ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                              : 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                          }`}
                        >
                          {inv.status_bayar}
                        </button>
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {formatDate(inv.tanggal)} · {items.length} item · {rupiah(inv.total)}
                      </p>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <button onClick={() => reprint(inv)} className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium px-3 py-1.5 border border-blue-200 rounded-lg hover:bg-blue-50">
                        <Printer className="w-3.5 h-3.5" /> Cetak
                      </button>
                      <button onClick={() => softDelete(inv.id)} className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700 font-medium px-3 py-1.5 border border-red-200 rounded-lg hover:bg-red-50">
                        <Trash2 className="w-3.5 h-3.5" /> Hapus
                      </button>
                    </div>
                  </div>
                )
              })}
              {riwayatHasMore && (
                <button
                  onClick={loadMoreRiwayat}
                  disabled={riwayatLoading}
                  className="w-full py-3 text-sm text-slate-500 hover:text-slate-700 bg-slate-50 hover:bg-slate-100 rounded-lg border border-slate-200 font-medium transition-colors disabled:opacity-60"
                >
                  {riwayatLoading ? 'Memuat...' : 'Muat Lainnya'}
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}