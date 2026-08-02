import { useEffect, useState } from 'react'
import { Plus, Printer, Trash2, History, ReceiptText, CheckCircle2, Clock3 } from 'lucide-react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../lib/AuthContext'
import { useToast } from '../lib/ToastContext'
import type { Vendor, Job, Invoice, InvoiceItem } from '../lib/types'
import { rupiah, formatDate, todayStr } from '../lib/utils'

export default function Invoices() {
  const { user } = useAuth()
  const { toast, confirm } = useToast()

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

  const totalLunas = invoices.filter((i) => i.status_bayar === 'Lunas').reduce((s, i) => s + i.total, 0)
  const totalPiutang = invoices.filter((i) => i.status_bayar !== 'Lunas').reduce((s, i) => s + i.total, 0)

  async function generateInvoice() {
    if (selectedJobs.length === 0) return toast({ type: 'error', title: 'Pilih minimal 1 job.' })
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
      toast({ type: 'error', title: 'Gagal membuat invoice', message: error.message })
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
    toast({ type: 'success', title: 'Invoice dibuat', message: `${invNumber} untuk ${vendor?.nama ?? ''}` })
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
      .update({ status_bayar: newStatus, user_id: user!.id })
      .eq('id', inv.id)

    if (invErr) return toast({ type: 'error', title: 'Gagal update invoice', message: invErr.message })

    // Sync jobs by ID (reliable - no name collision)
    const jobUpdate: Record<string, unknown> = {
      status_bayar: newStatus,
      updated_at: new Date().toISOString(),
      user_id: user!.id,
    }
    if (newStatus === 'Lunas') jobUpdate.tanggal_lunas = todayStr()
    else jobUpdate.tanggal_lunas = null

    const { error: jobErr } = await supabase
      .from('job')
      .update(jobUpdate)
      .in('id', jobIds)
      .is('deleted_at', null)

    if (jobErr) toast({ type: 'error', title: 'Invoice diupdate, tapi gagal sync job', message: jobErr.message })
    else toast({ type: 'success', title: `Invoice ditandai ${newStatus}` })

    await loadInitial()
  }

  async function softDelete(id: string) {
    const ok = await confirm({ title: 'Hapus invoice ini?', confirmLabel: 'Hapus', danger: true })
    if (!ok) return
    const { error } = await supabase
      .from('invoice')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
    if (error) {
      toast({ type: 'error', title: 'Gagal hapus', message: error.message })
      return
    }
    toast({ type: 'success', title: 'Invoice dihapus' })
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
    <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-5">
      {/* Summary strip */}
      <div className="grid grid-cols-3 gap-3 md:gap-4">
        <SummaryCard icon={ReceiptText} label="Total Invoice" value={String(invoices.length)} gradient="from-sky-500 to-indigo-500" />
        <SummaryCard icon={Clock3} label="Piutang" value={rupiah(totalPiutang)} gradient="from-amber-500 to-orange-500" small />
        <SummaryCard icon={CheckCircle2} label="Lunas" value={rupiah(totalLunas)} gradient="from-emerald-500 to-teal-500" small />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-50 border border-slate-300 rounded-xl p-1 w-fit">
        <button
          onClick={() => setTab('buat')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${tab === 'buat' ? 'bg-rose-500/15 text-rose-300 shadow-inner' : 'text-slate-500 hover:text-slate-900'}`}
        >
          <Plus className="w-4 h-4" /> Buat Invoice
        </button>
        <button
          onClick={() => setTab('riwayat')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${tab === 'riwayat' ? 'bg-rose-500/15 text-rose-300 shadow-inner' : 'text-slate-500 hover:text-slate-900'}`}
        >
          <History className="w-4 h-4" /> Riwayat
        </button>
      </div>

      {tab === 'buat' && (
        <div className="card p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Pilih Vendor</label>
            <select
              value={selectedVendor}
              onChange={(e) => loadUnpaid(e.target.value)}
              className="input-base sm:w-80"
            >
              <option value="">-- Pilih vendor --</option>
              {vendors.map((v) => (
                <option key={v.id} value={v.id}>{v.nama}</option>
              ))}
            </select>
          </div>

          {selectedVendor && unpaidJobs.length === 0 && (
            <div className="py-10 text-center">
              <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-slate-50 mx-auto">
                <CheckCircle2 className="w-6 h-6 text-slate-500" />
              </div>
              <p className="text-sm text-slate-500 mt-3">Tidak ada job belum bayar untuk vendor ini.</p>
            </div>
          )}

          {unpaidJobs.length > 0 && (
            <>
              <div className="divide-y divide-slate-200 border border-slate-300 rounded-xl overflow-hidden">
                {unpaidJobs.map((j) => (
                  <label key={j.id} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 cursor-pointer transition-colors">
                    <input
                      type="checkbox"
                      checked={checked.has(j.id)}
                      onChange={() => toggleJob(j.id)}
                      className="w-4 h-4 rounded accent-rose-500"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900 truncate">{j.nama_project}</p>
                      <p className="text-xs text-slate-500">{j.jenis_edit}</p>
                    </div>
                    <span className="text-sm font-medium text-slate-600 shrink-0">{rupiah(j.harga)}</span>
                  </label>
                ))}
              </div>

              <div className="flex items-center justify-between pt-2 flex-wrap gap-3">
                <div>
                  <p className="text-xs text-slate-500">{selectedJobs.length} item dipilih</p>
                  <p className="text-xl font-extrabold text-slate-900">{rupiah(total)}</p>
                </div>
                <button
                  onClick={generateInvoice}
                  disabled={generating || selectedJobs.length === 0}
                  className="btn-primary"
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
            <div className="card p-16 text-center">
              <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-sky-500 to-indigo-500 shadow-lg shadow-sky-500/30 mx-auto">
                <ReceiptText className="w-7 h-7 text-white" />
              </div>
              <p className="text-slate-900 font-medium mt-4">Belum ada invoice.</p>
              <p className="text-sm text-slate-500 mt-1">Buat invoice pertama Anda dari tab "Buat Invoice".</p>
            </div>
          ) : (
            <>
              {invoices.map((inv) => {
                const items: InvoiceItem[] = JSON.parse(inv.items_json)
                return (
                  <div key={inv.id} className="card card-hover p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-rose-500 to-orange-400 text-white shadow-md shadow-rose-500/30 shrink-0">
                        <ReceiptText className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-sm text-slate-900 truncate">{inv.vendor_nama}</h3>
                          <button
                            onClick={() => toggleStatus(inv)}
                            className={`badge cursor-pointer border ${
                              inv.status_bayar === 'Lunas'
                                ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20 hover:bg-emerald-500/20'
                                : 'bg-amber-500/10 text-amber-300 border-amber-500/20 hover:bg-amber-500/20'
                            }`}
                          >
                            {inv.status_bayar}
                          </button>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5 truncate">
                          {formatDate(inv.tanggal)} · {items.length} item · <span className="font-semibold text-slate-600">{rupiah(inv.total)}</span>
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <button onClick={() => reprint(inv)} className="flex items-center gap-1 text-xs text-sky-400 hover:text-sky-300 font-semibold px-3 py-1.5 border border-sky-500/25 rounded-lg hover:bg-sky-500/10 transition-colors">
                        <Printer className="w-3.5 h-3.5" /> Cetak
                      </button>
                      <button onClick={() => softDelete(inv.id)} className="flex items-center gap-1 text-xs text-red-400 hover:text-red-300 font-semibold px-3 py-1.5 border border-red-500/25 rounded-lg hover:bg-red-500/10 transition-colors">
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
                  className="w-full py-3 text-sm text-slate-500 hover:text-slate-900 bg-white hover:bg-slate-50 rounded-xl border border-slate-300 font-semibold transition-colors disabled:opacity-60"
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

function SummaryCard({ icon: Icon, label, value, gradient, small }: { icon: React.ElementType; label: string; value: string; gradient: string; small?: boolean }) {
  return (
    <div className="card card-hover p-4 flex items-center gap-3">
      <div className={`kpi-chip bg-gradient-to-br ${gradient} !w-10 !h-10 !rounded-xl`}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="min-w-0">
        <p className="micro-label">{label}</p>
        <p className={`font-extrabold text-slate-900 mt-0.5 truncate ${small ? 'text-sm' : 'text-base'}`}>{value}</p>
      </div>
    </div>
  )
}
