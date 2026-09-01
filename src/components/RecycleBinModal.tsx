import { useEffect, useMemo, useState } from 'react'
import { X, ClipboardList, Users, ReceiptText, RotateCcw, Trash2, Search } from 'lucide-react'
import { supabase } from '../lib/supabaseClient'
import { useToast } from '../lib/ToastContext'
import type { Job, Vendor, Invoice } from '../lib/types'

type Tab = 'job' | 'vendor' | 'invoice'

interface ItemMeta {
  id: string
  nama: string
  detail: string
  deletedAt: string
}

export default function RecycleBinModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { toast, confirm } = useToast()
  const [tab, setTab] = useState<Tab>('job')
  const [loading, setLoading] = useState(false)
  const [jobs, setJobs] = useState<Job[]>([])
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [q, setQ] = useState('')

  useEffect(() => {
    if (open) loadData()
  }, [open])

  async function loadData() {
    setLoading(true)
    const [j, v, i] = await Promise.all([
      supabase.from('job').select('*').not('deleted_at', 'is', null).order('deleted_at', { ascending: false }),
      supabase.from('vendor').select('*').not('deleted_at', 'is', null).order('deleted_at', { ascending: false }),
      supabase.from('invoice').select('*').not('deleted_at', 'is', null).order('deleted_at', { ascending: false }),
    ])
    if (!j.error) setJobs((j.data ?? []) as Job[])
    if (!v.error) setVendors((v.data ?? []) as Vendor[])
    if (!i.error) setInvoices((i.data ?? []) as Invoice[])
    setLoading(false)
  }

  const meta: Record<Tab, ItemMeta[]> = useMemo(() => ({
    job: jobs.map((x) => ({
      id: x.id,
      nama: x.nama_project,
      detail: `${x.vendor?.nama ?? 'Tanpa vendor'} · ${x.jenis_edit} · ${x.status_edit}`,
      deletedAt: x.deleted_at ?? x.updated_at ?? '',
    })),
    vendor: vendors.map((x) => ({
      id: x.id,
      nama: x.nama,
      detail: x.whatsapp ? `WA: ${x.whatsapp}` : 'Tanpa kontak',
      deletedAt: x.deleted_at ?? x.updated_at ?? '',
    })),
    invoice: invoices.map((x) => ({
      id: x.id,
      nama: `Invoice ${x.vendor_nama}`,
      detail: `${x.vendor_nama} · ${x.status_bayar}`,
      deletedAt: x.deleted_at ?? x.created_at ?? '',
    })),
  }), [jobs, vendors, invoices])

  const items = meta[tab].filter((x) =>
    x.nama.toLowerCase().includes(q.toLowerCase()) ||
    x.detail.toLowerCase().includes(q.toLowerCase())
  )

  async function restore(item: ItemMeta) {
    const { error } = await supabase.from(tab).update({ deleted_at: null }).eq('id', item.id)
    if (error) return toast({ type: 'error', title: 'Gagal memulihkan', message: error.message })
    await loadData()
    toast({ type: 'success', title: `"${item.nama}" dipulihkan` })
  }

  async function restoreAll() {
    if (items.length === 0) return
    const ids = items.map((x) => x.id)
    const { error } = await supabase.from(tab).update({ deleted_at: null }).in('id', ids)
    if (error) return toast({ type: 'error', title: 'Gagal memulihkan', message: error.message })
    await loadData()
    toast({ type: 'success', title: `${ids.length} item dipulihkan` })
  }

  async function purge(item: ItemMeta) {
    const ok = await confirm({
      title: 'Hapus permanen?',
      message: `"${item.nama}" akan dihapus permanen dan tidak bisa dikembalikan.`,
      confirmLabel: 'Hapus Permanen',
      danger: true,
    })
    if (!ok) return
    const { error } = await supabase.from(tab).delete().eq('id', item.id)
    if (error) return toast({ type: 'error', title: 'Gagal menghapus', message: error.message })
    await loadData()
    toast({ type: 'success', title: `"${item.nama}" dihapus permanen` })
  }

  async function purgeAll() {
    if (items.length === 0) return
    const ok = await confirm({
      title: 'Kosongkan Recycle Bin?',
      message: `${items.length} item akan dihapus permanen dan tidak bisa dikembalikan.`,
      confirmLabel: 'Hapus Semua',
      danger: true,
    })
    if (!ok) return
    const ids = items.map((x) => x.id)
    const { error } = await supabase.from(tab).delete().in('id', ids)
    if (error) return toast({ type: 'error', title: 'Gagal menghapus', message: error.message })
    await loadData()
    toast({ type: 'success', title: `${ids.length} item dihapus permanen` })
  }

  const tabs: { id: Tab; label: string; icon: typeof ClipboardList; count: number }[] = [
    { id: 'job', label: 'Job', icon: ClipboardList, count: jobs.length },
    { id: 'vendor', label: 'Vendor', icon: Users, count: vendors.length },
    { id: 'invoice', label: 'Invoice', icon: ReceiptText, count: invoices.length },
  ]

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
      <div className="card w-full max-w-lg max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-5 pb-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center">
              <Trash2 className="w-5 h-5 text-orange-500" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Recycle Bin</h2>
              <p className="text-sm text-slate-500">Data yang dihapus akan tersimpan 30 hari.</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded">
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        <div className="p-5 pb-3">
          <div className="flex flex-wrap items-center gap-1">
            {tabs.map((t) => {
              const Icon = t.icon
              return (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold transition-all ${
                    tab === t.id ? 'bg-gradient-to-r from-rose-600 to-rose-500 text-white shadow-md shadow-rose-500/30' : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <Icon className="w-4 h-4" /> {t.label}
                  <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${tab === t.id ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-600'}`}>
                    {t.count}
                  </span>
                </button>
              )
            })}
          </div>

          <div className="relative mt-3">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Cari di recycle bin…"
              className="input-base pl-9"
            />
          </div>
        </div>

        <div className="px-5 pb-2 flex items-center justify-end gap-2">
          {items.length > 0 && (
            <>
              <button onClick={restoreAll} className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 hover:bg-emerald-50 rounded-lg px-2.5 py-1.5 transition-colors">
                <RotateCcw className="w-3.5 h-3.5" /> Pulihkan Semua
              </button>
              <button onClick={purgeAll} className="inline-flex items-center gap-1 text-xs font-semibold text-rose-600 hover:bg-rose-50 rounded-lg px-2.5 py-1.5 transition-colors">
                <Trash2 className="w-3.5 h-3.5" /> Kosongkan
              </button>
            </>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-5 pb-5 min-h-[180px]">
          {loading ? (
            <div className="flex items-center justify-center h-40">
              <div className="animate-spin rounded-full h-8 w-8 border-4 border-rose-500 border-t-transparent" />
            </div>
          ) : items.length === 0 ? (
            <div className="py-12 text-center">
              <Trash2 className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500 text-sm">
                {meta[tab].length === 0 ? 'Recycle bin kosong.' : 'Tidak ada hasil pencarian.'}
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {items.map((item) => (
                <li key={item.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">{item.nama}</p>
                    <p className="text-xs text-slate-500 truncate">{item.detail}</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Dihapus {item.deletedAt ? new Date(item.deletedAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-2">
                    <button onClick={() => restore(item)} className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 hover:bg-emerald-50 rounded-lg px-2.5 py-1.5 transition-colors">
                      <RotateCcw className="w-3.5 h-3.5" /> Pulihkan
                    </button>
                    <button onClick={() => purge(item)} className="inline-flex items-center gap-1 text-xs font-semibold text-rose-600 hover:bg-rose-50 rounded-lg px-2.5 py-1.5 transition-colors">
                      <Trash2 className="w-3.5 h-3.5" /> Hapus
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
