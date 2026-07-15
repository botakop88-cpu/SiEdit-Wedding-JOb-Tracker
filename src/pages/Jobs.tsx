import { useEffect, useState, useMemo, type FormEvent } from 'react'
import { Plus, Search, Trash2, Pencil, X, CheckSquare, Square } from 'lucide-react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../lib/AuthContext'
import type {
  Job, Vendor, JenisEdit, StatusEdit, StatusBayar, StatusCetak, JobFilter,
} from '../lib/types'
import {
  JENIS_EDIT_OPTIONS, STATUS_EDIT_OPTIONS, STATUS_BAYAR_OPTIONS, STATUS_CETAK_OPTIONS,
} from '../lib/types'
import { rupiah, formatDate, daysUntil, todayStr } from '../lib/utils'

const EMPTY_FORM = {
  vendor_id: '',
  nama_project: '',
  jenis_edit: 'Kolase Sudah Pilih' as JenisEdit,
  harga: 0,
  deadline: '',
  status_edit: 'Masuk' as StatusEdit,
  status_bayar: 'Belum Bayar' as StatusBayar,
  status_cetak: 'Belum Cetak' as StatusCetak,
  catatan: '',
}

export default function Jobs() {
  const { user } = useAuth()
  const [jobs, setJobs] = useState<Job[]>([])
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<JobFilter>('Semua')
  const [filterVendor, setFilterVendor] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState<Job | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    setLoading(true)
    const [jRes, vRes] = await Promise.all([
      supabase.from('job').select('*, vendor:vendor_id(nama)').is('deleted_at', null).order('created_at', { ascending: false }),
      supabase.from('vendor').select('*').is('deleted_at', null).order('nama'),
    ])
    if (jRes.data) setJobs(jRes.data as Job[])
    if (vRes.data) setVendors(vRes.data as Vendor[])
    setSelected(new Set())
    setLoading(false)
  }

  // Auto-fill harga when vendor/jenis changes
  function updateHarga(vendorId: string, jenis: JenisEdit) {
    const v = vendors.find((x) => x.id === vendorId)
    if (!v) return 0
    if (jenis === 'Kolase Sudah Pilih') return v.harga_kolase_sudah_pilih
    if (jenis === 'Kolase Belum Pilih') return v.harga_kolase_belum_pilih
    return v.harga_edit_full
  }

  function openNew() {
    setEditing(null)
    setForm(EMPTY_FORM)
    setModal(true)
  }

  function openEdit(job: Job) {
    setEditing(job)
    setForm({
      vendor_id: job.vendor_id ?? '',
      nama_project: job.nama_project,
      jenis_edit: job.jenis_edit,
      harga: job.harga,
      deadline: job.deadline ?? '',
      status_edit: job.status_edit,
      status_bayar: job.status_bayar,
      status_cetak: job.status_cetak,
      catatan: job.catatan ?? '',
    })
    setModal(true)
  }

  function setField<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((prev) => {
      const next = { ...prev, [key]: value }
      if (key === 'vendor_id' || key === 'jenis_edit') {
        const vid = key === 'vendor_id' ? (value as string) : next.vendor_id
        const jenis = key === 'jenis_edit' ? (value as JenisEdit) : next.jenis_edit
        if (vid) next.harga = updateHarga(vid, jenis)
      }
      return next
    })
  }

  async function saveJob(e: FormEvent) {
    e.preventDefault()
    if (!form.nama_project.trim()) return alert('Nama project wajib diisi.')
    setSaving(true)

    const payload = {
      user_id: user!.id,
      vendor_id: form.vendor_id || null,
      nama_project: form.nama_project.trim(),
      jenis_edit: form.jenis_edit,
      harga: form.harga,
      deadline: form.deadline || null,
      status_edit: form.status_edit,
      status_bayar: form.status_bayar,
      status_cetak: form.status_cetak,
      catatan: form.catatan || null,
      tanggal_lunas: form.status_bayar === 'Lunas' ? (editing?.tanggal_lunas ?? todayStr()) : null,
      updated_at: new Date().toISOString(),
    }

    let error
    if (editing) {
      ;({ error } = await supabase.from('job').update(payload).eq('id', editing.id))
    } else {
      ;({ error } = await supabase.from('job').insert(payload))
    }

    if (error) alert('Gagal menyimpan: ' + error.message)
    else {
      setModal(false)
      await loadData()
    }
    setSaving(false)
  }

  async function softDelete(id: string) {
    if (!confirm('Hapus job ini?')) return
    const { error } = await supabase
      .from('job')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
    if (error) {
      alert('Gagal hapus: ' + error.message)
      return
    }
    await loadData()
  }

  async function bulkAction(action: 'lunas' | 'belum' | 'hapus') {
    if (selected.size === 0) return
    const ids = Array.from(selected)
    let error
    if (action === 'hapus') {
      if (!confirm(`Hapus ${ids.length} job?`)) return
      ;({ error } = await supabase.from('job').update({
        deleted_at: new Date().toISOString(),
      }).in('id', ids))
    } else if (action === 'lunas') {
      ;({ error } = await supabase.from('job').update({
        status_bayar: 'Lunas',
        tanggal_lunas: todayStr(),
        updated_at: new Date().toISOString(),
      }).in('id', ids))
    } else {
      ;({ error } = await supabase.from('job').update({
        status_bayar: 'Belum Bayar',
        tanggal_lunas: null,
        updated_at: new Date().toISOString(),
      }).in('id', ids))
    }
    if (error) {
      alert('Gagal: ' + error.message)
      return
    }
    await loadData()
  }

  // Filtering
  const filtered = useMemo(() => {
    let list = jobs
    if (search) {
      const q = search.toLowerCase()
      list = list.filter(
        (j) =>
          j.nama_project.toLowerCase().includes(q) ||
          (j.vendor?.nama ?? '').toLowerCase().includes(q),
      )
    }
    if (filterVendor) list = list.filter((j) => j.vendor_id === filterVendor)
    if (filter === 'Belum Bayar') list = list.filter((j) => j.status_bayar === 'Belum Bayar')
    else if (filter === 'Lunas') list = list.filter((j) => j.status_bayar === 'Lunas')
    else if (filter === 'Sedang Edit') list = list.filter((j) => j.status_edit === 'Sedang Edit')
    else if (filter === 'Sudah Cetak') list = list.filter((j) => j.status_cetak === 'Sudah Cetak')
    else if (filter === 'Belum Cetak') list = list.filter((j) => j.status_cetak === 'Belum Cetak')
    else if (filter === 'Deadline ≤ 3 Hari') {
      list = list.filter((j) => {
        if (!j.deadline) return false
        const d = daysUntil(j.deadline)
        return d >= 0 && d <= 3
      })
    }
    return list
  }, [jobs, search, filter, filterVendor])

  // Group by vendor
  const grouped = useMemo(() => {
    const map = new Map<string, { name: string; jobs: Job[]; belumBayar: number }>()
    for (const j of filtered) {
      const key = j.vendor_id ?? '__none__'
      const name = j.vendor?.nama ?? 'Tanpa Vendor'
      if (!map.has(key)) map.set(key, { name, jobs: [], belumBayar: 0 })
      const g = map.get(key)!
      g.jobs.push(j)
      if (j.status_bayar === 'Belum Bayar') g.belumBayar++
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name))
  }, [filtered])

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleAll() {
    if (selected.size === filtered.length) setSelected(new Set())
    else setSelected(new Set(filtered.map((j) => j.id)))
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
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Daftar Job</h1>
          <p className="text-sm text-slate-500">{filtered.length} job</p>
        </div>
        <button onClick={openNew} className="flex items-center gap-1.5 bg-rose-600 hover:bg-rose-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
          <Plus className="w-4 h-4" /> Tambah
        </button>
      </div>

      {/* Search & filters */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari project / vendor..."
            className="w-full border border-slate-300 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
          />
        </div>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value as JobFilter)}
          className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
        >
          {(['Semua', 'Belum Bayar', 'Lunas', 'Sedang Edit', 'Deadline ≤ 3 Hari', 'Sudah Cetak', 'Belum Cetak'] as JobFilter[]).map((f) => (
            <option key={f} value={f}>{f}</option>
          ))}
        </select>
        <select
          value={filterVendor}
          onChange={(e) => setFilterVendor(e.target.value)}
          className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
        >
          <option value="">Semua Vendor</option>
          {vendors.map((v) => (
            <option key={v.id} value={v.id}>{v.nama}</option>
          ))}
        </select>
      </div>

      {/* Bulk actions */}
      {selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 bg-rose-50 border border-rose-200 rounded-lg px-4 py-2.5 text-sm">
          <span className="font-medium text-rose-700">{selected.size} dipilih</span>
          <button onClick={() => bulkAction('lunas')} className="px-3 py-1 bg-emerald-600 text-white rounded-md text-xs font-medium hover:bg-emerald-700">Tandai Lunas</button>
          <button onClick={() => bulkAction('belum')} className="px-3 py-1 bg-amber-500 text-white rounded-md text-xs font-medium hover:bg-amber-600">Tandai Belum Bayar</button>
          <button onClick={() => bulkAction('hapus')} className="px-3 py-1 bg-red-600 text-white rounded-md text-xs font-medium hover:bg-red-700">Hapus</button>
        </div>
      )}

      {/* Select all */}
      {filtered.length > 0 && (
        <button onClick={toggleAll} className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700">
          {selected.size === filtered.length ? <CheckSquare className="w-3.5 h-3.5" /> : <Square className="w-3.5 h-3.5" />}
          Pilih semua
        </button>
      )}

      {/* Grouped list */}
      {grouped.length === 0 ? (
        <div className="text-center py-16 text-slate-400 text-sm">Belum ada job. Klik Tambah untuk mulai.</div>
      ) : (
        grouped.map((g) => (
          <section key={g.name} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-100">
              <h3 className="font-semibold text-sm text-slate-700">{g.name}</h3>
              <span className="text-xs text-slate-400">{g.jobs.length} job · {g.belumBayar} belum bayar</span>
            </div>

            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-slate-500 border-b border-slate-100">
                    <th className="px-4 py-2 w-8" />
                    <th className="px-4 py-2">Project</th>
                    <th className="px-4 py-2">Jenis</th>
                    <th className="px-4 py-2">Harga</th>
                    <th className="px-4 py-2">Deadline</th>
                    <th className="px-4 py-2">Status</th>
                    <th className="px-4 py-2">Bayar</th>
                    <th className="px-4 py-2">Cetak</th>
                    <th className="px-4 py-2 w-20" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {g.jobs.map((j) => (
                    <tr key={j.id} className="hover:bg-slate-50">
                      <td className="px-4 py-2.5">
                        <button onClick={() => toggleSelect(j.id)}>
                          {selected.has(j.id) ? <CheckSquare className="w-4 h-4 text-rose-600" /> : <Square className="w-4 h-4 text-slate-300" />}
                        </button>
                      </td>
                      <td className="px-4 py-2.5 font-medium text-slate-800">{j.nama_project}</td>
                      <td className="px-4 py-2.5">{badgeJenis(j.jenis_edit)}</td>
                      <td className="px-4 py-2.5">{rupiah(j.harga)}</td>
                      <td className="px-4 py-2.5 text-slate-500">{formatDate(j.deadline)}</td>
                      <td className="px-4 py-2.5">{badgeEdit(j.status_edit)}</td>
                      <td className="px-4 py-2.5">{badgeBayar(j.status_bayar)}</td>
                      <td className="px-4 py-2.5">{badgeCetak(j.status_cetak)}</td>
                      <td className="px-4 py-2.5">
                        <div className="flex gap-1">
                          <button onClick={() => openEdit(j)} className="p-1 text-slate-400 hover:text-blue-600"><Pencil className="w-3.5 h-3.5" /></button>
                          <button onClick={() => softDelete(j.id)} className="p-1 text-slate-400 hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden divide-y divide-slate-50">
              {g.jobs.map((j) => (
                <div key={j.id} className="p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2 min-w-0">
                      <button onClick={() => toggleSelect(j.id)} className="mt-0.5">
                        {selected.has(j.id) ? <CheckSquare className="w-4 h-4 text-rose-600" /> : <Square className="w-4 h-4 text-slate-300" />}
                      </button>
                      <div className="min-w-0">
                        <p className="font-medium text-sm text-slate-800 truncate">{j.nama_project}</p>
                        <p className="text-xs text-slate-400">{j.jenis_edit} · {rupiah(j.harga)}</p>
                      </div>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <button onClick={() => openEdit(j)} className="p-1.5 text-slate-400 hover:text-blue-600"><Pencil className="w-3.5 h-3.5" /></button>
                      <button onClick={() => softDelete(j.id)} className="p-1.5 text-slate-400 hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5 pl-6">
                    {badgeEdit(j.status_edit)}
                    {badgeBayar(j.status_bayar)}
                    {badgeCetak(j.status_cetak)}
                    {j.deadline && <span className="text-xs text-slate-400">{formatDate(j.deadline)}</span>}
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))
      )}

      {/* Modal form */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4">
          <div className="bg-white w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 sticky top-0 bg-white z-10">
              <h2 className="font-semibold text-slate-800">{editing ? 'Edit Job' : 'Tambah Job'}</h2>
              <button onClick={() => setModal(false)} className="p-1 text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={saveJob} className="p-5 space-y-4 pb-16 sm:pb-5">
              <Field label="Vendor">
                <select required value={form.vendor_id} onChange={(e) => setField('vendor_id', e.target.value)} className={inputCls}>
                  <option value="">Pilih vendor</option>
                  {vendors.map((v) => <option key={v.id} value={v.id}>{v.nama}</option>)}
                </select>
              </Field>
              <Field label="Nama Project">
                <input required value={form.nama_project} onChange={(e) => setField('nama_project', e.target.value)} className={inputCls} placeholder="Pre-wedding & Budi" />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Jenis Edit">
                  <select value={form.jenis_edit} onChange={(e) => setField('jenis_edit', e.target.value as JenisEdit)} className={inputCls}>
                    {JENIS_EDIT_OPTIONS.map((o) => <option key={o}>{o}</option>)}
                  </select>
                </Field>
                <Field label="Harga">
                  <input type="number" min={0} value={form.harga} onChange={(e) => setField('harga', Number(e.target.value))} className={inputCls} />
                </Field>
              </div>
              <Field label="Deadline">
                <input type="date" value={form.deadline} onChange={(e) => setField('deadline', e.target.value)} className={inputCls} />
              </Field>
              <div className="grid grid-cols-3 gap-3">
                <Field label="Status Edit">
                  <select value={form.status_edit} onChange={(e) => setField('status_edit', e.target.value as StatusEdit)} className={inputCls}>
                    {STATUS_EDIT_OPTIONS.map((o) => <option key={o}>{o}</option>)}
                  </select>
                </Field>
                <Field label="Status Bayar">
                  <select value={form.status_bayar} onChange={(e) => setField('status_bayar', e.target.value as StatusBayar)} className={inputCls}>
                    {STATUS_BAYAR_OPTIONS.map((o) => <option key={o}>{o}</option>)}
                  </select>
                </Field>
                <Field label="Status Cetak">
                  <select value={form.status_cetak} onChange={(e) => setField('status_cetak', e.target.value as StatusCetak)} className={inputCls}>
                    {STATUS_CETAK_OPTIONS.map((o) => <option key={o}>{o}</option>)}
                  </select>
                </Field>
              </div>
              <Field label="Catatan">
                <textarea value={form.catatan} onChange={(e) => setField('catatan', e.target.value)} rows={2} className={inputCls} placeholder="Opsional" />
              </Field>
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setModal(false)} className="flex-1 border border-slate-300 text-slate-600 rounded-lg py-2.5 text-sm font-medium hover:bg-slate-50">Batal</button>
                <button type="submit" disabled={saving} className="flex-1 bg-rose-600 hover:bg-rose-700 disabled:opacity-60 text-white rounded-lg py-2.5 text-sm font-medium">
                  {saving ? 'Menyimpan...' : 'Simpan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

const inputCls = 'w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>
      {children}
    </div>
  )
}

function badgeJenis(v: string) {
  return <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">{v}</span>
}
function badgeEdit(v: string) {
  const colors: Record<string, string> = {
    Masuk: 'bg-slate-100 text-slate-600',
    'Sedang Edit': 'bg-blue-100 text-blue-700',
    Revisi: 'bg-orange-100 text-orange-700',
    Selesai: 'bg-emerald-100 text-emerald-700',
    'Sudah Dikirim': 'bg-purple-100 text-purple-700',
  }
  return <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${colors[v] ?? 'bg-slate-100 text-slate-600'}`}>{v}</span>
}
function badgeBayar(v: string) {
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${v === 'Lunas' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
      {v}
    </span>
  )
}
function badgeCetak(v: string) {
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${v === 'Sudah Cetak' ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-500'}`}>
      {v}
    </span>
  )
}