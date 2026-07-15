import { useEffect, useState } from 'react'
import { RotateCcw, Trash2, AlertTriangle, Database, Info, LogOut } from 'lucide-react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../lib/AuthContext'
import type { Job, Vendor, Invoice } from '../lib/types'
import { formatDate, rupiah } from '../lib/utils'

type RecycleTab = 'job' | 'vendor' | 'invoice'

export default function Settings() {
  const { user, signOut } = useAuth()
  const [counts, setCounts] = useState({ jobs: 0, vendors: 0, invoices: 0 })
  const [recycleTab, setRecycleTab] = useState<RecycleTab>('job')
  const [deletedJobs, setDeletedJobs] = useState<Job[]>([])
  const [deletedVendors, setDeletedVendors] = useState<Vendor[]>([])
  const [deletedInvoices, setDeletedInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    setLoading(true)
    const [jC, vC, iC] = await Promise.all([
      supabase.from('job').select('*', { count: 'exact', head: true }).is('deleted_at', null),
      supabase.from('vendor').select('*', { count: 'exact', head: true }).is('deleted_at', null),
      supabase.from('invoice').select('*', { count: 'exact', head: true }).is('deleted_at', null),
    ])
    setCounts({
      jobs: jC.count ?? 0,
      vendors: vC.count ?? 0,
      invoices: iC.count ?? 0,
    })

    // Load deleted items directly via Supabase (RLS will filter by user_id)
    const [jRes, vRes, iRes] = await Promise.all([
      supabase.from('job').select('*').not('deleted_at', 'is', null).order('deleted_at', { ascending: false }),
      supabase.from('vendor').select('*').not('deleted_at', 'is', null).order('deleted_at', { ascending: false }),
      supabase.from('invoice').select('*').not('deleted_at', 'is', null).order('deleted_at', { ascending: false }),
    ])
    if (jRes.data) setDeletedJobs(jRes.data as Job[])
    if (vRes.data) setDeletedVendors(vRes.data as Vendor[])
    if (iRes.data) setDeletedInvoices(iRes.data as Invoice[])
    setLoading(false)
  }

  async function restore(table: string, id: string) {
    const { error } = await supabase
      .from(table)
      .update({ deleted_at: null, user_id: user!.id })
      .eq('id', id)
    if (error) {
      alert('Gagal pulihkan: ' + error.message)
      return
    }
    await loadAll()
  }

  async function hardDelete(table: string, id: string) {
    if (!confirm('Hapus permanen? Tindakan ini tidak dapat dibatalkan.')) return
    const { error } = await supabase
      .from(table)
      .delete()
      .eq('id', id)
    if (error) {
      alert('Gagal hapus: ' + error.message)
      return
    }
    await loadAll()
  }

  async function emptyTrash() {
    const total = deletedJobs.length + deletedVendors.length + deletedInvoices.length
    if (total === 0) return
    const detail = [
      deletedJobs.length > 0 && `${deletedJobs.length} job`,
      deletedVendors.length > 0 && `${deletedVendors.length} vendor`,
      deletedInvoices.length > 0 && `${deletedInvoices.length} invoice`,
    ].filter(Boolean).join(', ')
    if (!confirm(`Kosongkan seluruh sampah?\n\n${detail} akan dihapus permanen.\nTindakan ini tidak dapat dibatalkan!`)) return
    
    const promises = []
    if (deletedJobs.length > 0) {
      promises.push(supabase.from('job').delete().in('id', deletedJobs.map(j => j.id)))
    }
    if (deletedVendors.length > 0) {
      promises.push(supabase.from('vendor').delete().in('id', deletedVendors.map(v => v.id)))
    }
    if (deletedInvoices.length > 0) {
      promises.push(supabase.from('invoice').delete().in('id', deletedInvoices.map(i => i.id)))
    }
    
    const results = await Promise.all(promises)
    const errors = results.filter(r => r.error).map(r => r.error!.message)
    if (errors.length > 0) {
      alert('Gagal kosongkan sampah: ' + errors.join(', '))
      return
    }
    await loadAll()
  }

  const trashCount = deletedJobs.length + deletedVendors.length + deletedInvoices.length

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-4 border-rose-500 border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Pengaturan</h1>
        <p className="text-sm text-slate-500">Informasi aplikasi & recycle bin</p>
      </div>

      {/* App info */}
      <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-3">
        <div className="flex items-center gap-2 mb-1">
          <Info className="w-4 h-4 text-blue-500" />
          <h2 className="font-semibold text-sm text-slate-800">Informasi Aplikasi</h2>
        </div>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <dt className="text-slate-400">Versi</dt>
          <dd className="text-slate-700 font-medium">1.0.0</dd>
          <dt className="text-slate-400">Database</dt>
          <dd className="text-slate-700 font-medium">Supabase (PostgreSQL)</dd>
          <dt className="text-slate-400">Mode</dt>
          <dd className="text-slate-700 font-medium">Multi-User (Auth)</dd>
          <dt className="text-slate-400">Email</dt>
          <dd className="text-slate-700 font-medium truncate">{user?.email}</dd>
          <dt className="text-slate-400">Job aktif</dt>
          <dd className="text-slate-700 font-medium">{counts.jobs}</dd>
          <dt className="text-slate-400">Vendor aktif</dt>
          <dd className="text-slate-700 font-medium">{counts.vendors}</dd>
          <dt className="text-slate-400">Invoice aktif</dt>
          <dd className="text-slate-700 font-medium">{counts.invoices}</dd>
        </dl>
      </section>

      {/* Data location */}
      <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-2">
        <div className="flex items-center gap-2 mb-1">
          <Database className="w-4 h-4 text-emerald-500" />
          <h2 className="font-semibold text-sm text-slate-800">Lokasi Data</h2>
        </div>
        <p className="text-xs text-slate-500">Hosting: Vercel · Database: Supabase Cloud · Region: Singapore</p>
        <p className="text-xs text-slate-400">Data diisolasi per akun pengguna via Row Level Security (RLS).</p>
      </section>

      {/* Recycle Bin */}
      <section className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            <h2 className="font-semibold text-sm text-slate-800">Recycle Bin</h2>
            {trashCount > 0 && (
              <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">{trashCount}</span>
            )}
          </div>
          {trashCount > 0 && (
            <button onClick={emptyTrash} className="text-xs text-red-600 hover:text-red-800 font-medium">
              Kosongkan Sampah
            </button>
          )}
        </div>

        <div className="flex border-b border-slate-100">
          {([
            { key: 'job' as RecycleTab, label: `Job (${deletedJobs.length})` },
            { key: 'vendor' as RecycleTab, label: `Vendor (${deletedVendors.length})` },
            { key: 'invoice' as RecycleTab, label: `Invoice (${deletedInvoices.length})` },
          ]).map((t) => (
            <button
              key={t.key}
              onClick={() => setRecycleTab(t.key)}
              className={`flex-1 py-2.5 text-xs font-medium transition-colors ${
                recycleTab === t.key
                  ? 'text-rose-600 border-b-2 border-rose-600'
                  : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="divide-y divide-slate-50 max-h-80 overflow-y-auto">
          {recycleTab === 'job' && (
            deletedJobs.length === 0 ? (
              <p className="text-center py-8 text-xs text-slate-400">Kosong</p>
            ) : (
              deletedJobs.map((j) => (
                <div key={j.id} className="flex items-center justify-between px-5 py-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-700 truncate">{j.nama_project}</p>
                    <p className="text-xs text-slate-400">Dihapus: {formatDate(j.deleted_at?.slice(0, 10))}</p>
                  </div>
                  <div className="flex gap-1 shrink-0 ml-3">
                    <button onClick={() => restore('job', j.id)} className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded" title="Pulihkan"><RotateCcw className="w-3.5 h-3.5" /></button>
                    <button onClick={() => hardDelete('job', j.id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded" title="Hapus permanen"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                </div>
              ))
            )
          )}
          {recycleTab === 'vendor' && (
            deletedVendors.length === 0 ? (
              <p className="text-center py-8 text-xs text-slate-400">Kosong</p>
            ) : (
              deletedVendors.map((v) => (
                <div key={v.id} className="flex items-center justify-between px-5 py-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-700 truncate">{v.nama}</p>
                    <p className="text-xs text-slate-400">Dihapus: {formatDate(v.deleted_at?.slice(0, 10))}</p>
                  </div>
                  <div className="flex gap-1 shrink-0 ml-3">
                    <button onClick={() => restore('vendor', v.id)} className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded" title="Pulihkan"><RotateCcw className="w-3.5 h-3.5" /></button>
                    <button onClick={() => hardDelete('vendor', v.id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded" title="Hapus permanen"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                </div>
              ))
            )
          )}
          {recycleTab === 'invoice' && (
            deletedInvoices.length === 0 ? (
              <p className="text-center py-8 text-xs text-slate-400">Kosong</p>
            ) : (
              deletedInvoices.map((inv) => (
                <div key={inv.id} className="flex items-center justify-between px-5 py-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-700 truncate">{inv.vendor_nama} · {rupiah(inv.total)}</p>
                    <p className="text-xs text-slate-400">Dihapus: {formatDate(inv.deleted_at?.slice(0, 10))}</p>
                  </div>
                  <div className="flex gap-1 shrink-0 ml-3">
                    <button onClick={() => restore('invoice', inv.id)} className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded" title="Pulihkan"><RotateCcw className="w-3.5 h-3.5" /></button>
                    <button onClick={() => hardDelete('invoice', inv.id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded" title="Hapus permanen"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                </div>
              ))
            )
          )}
        </div>
      </section>

      {/* Logout (mobile) */}
      <button
        onClick={() => signOut()}
        className="md:hidden flex items-center justify-center gap-2 w-full border border-slate-300 text-slate-600 rounded-lg py-3 text-sm font-medium hover:bg-slate-50"
      >
        <LogOut className="w-4 h-4" /> Keluar
      </button>
    </div>
  )
}