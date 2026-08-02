import { useEffect, useState, useMemo, useRef, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Plus, Search, ChevronDown, ChevronUp, MoreVertical, Calendar, Folder, Pencil, Trash2, X, CheckCircle2, Wallet, CreditCard } from 'lucide-react'
import { supabase } from '../lib/supabaseClient'
import { useToast } from '../lib/ToastContext'
import type { Job, Vendor, JenisEdit, StatusEdit, StatusBayar, StatusCetak } from '../lib/types'
import { JENIS_EDIT_OPTIONS, STATUS_EDIT_OPTIONS, STATUS_BAYAR_OPTIONS, STATUS_CETAK_OPTIONS } from '../lib/types'
import { rupiah, formatDate, daysUntil } from '../lib/utils'

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

const VENDOR_COLORS: Record<string, string> = {
  'FIKI ETERNAL': 'bg-slate-900',
  'ERIK BASTERPICT': 'bg-orange-600',
  'YOUGA': 'bg-purple-600',
  'IRWAN VISUAL': 'bg-slate-700',
}

export default function Jobs() {
  const { toast } = useToast()
  const [searchParams] = useSearchParams()
  const [jobs, setJobs] = useState<Job[]>([])
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState(searchParams.get('q') ?? '')
  const [filterStatus, setFilterStatus] = useState('Semua Status')
  const [filterVendor, setFilterVendor] = useState('Semua Vendor')
  const [filterJenis, setFilterJenis] = useState('Semua Jenis')
  const [filterDeadline, setFilterDeadline] = useState('')
  const deadlinePickerRef = useRef<HTMLInputElement>(null)
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState<Job | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [menuFor, setMenuFor] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const searchRef = useRef<HTMLInputElement>(null)
  const prevStatusRef = useRef<Record<string, { status_edit: StatusEdit; status_bayar: StatusBayar; status_cetak: StatusCetak }>>({})

  useEffect(() => { loadData() }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        searchRef.current?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  async function loadData() {
    setLoading(true)
    const [jRes, vRes] = await Promise.all([
      supabase.from('job').select('*, vendor:vendor_id(nama)').is('deleted_at', null).order('vendor_id').order('deadline'),
      supabase.from('vendor').select('*').is('deleted_at', null).order('nama'),
    ])
    if (jRes.data) setJobs(jRes.data as Job[])
    if (vRes.data) setVendors(vRes.data as Vendor[])
    setLoading(false)
  }

  const filtered = useMemo(() => {
    let result = jobs
    if (search) {
      const q = search.toLowerCase()
      result = result.filter((j) => j.nama_project.toLowerCase().includes(q) || j.vendor?.nama.toLowerCase().includes(q))
    }
    if (filterStatus !== 'Semua Status') result = result.filter((j) => j.status_edit === filterStatus)
    if (filterVendor !== 'Semua Vendor') result = result.filter((j) => j.vendor?.nama === filterVendor)
    if (filterJenis !== 'Semua Jenis') result = result.filter((j) => j.jenis_edit === filterJenis)
    if (filterDeadline) result = result.filter((j) => j.deadline === filterDeadline)
    return result
  }, [jobs, search, filterStatus, filterVendor, filterJenis, filterDeadline])

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))

  useEffect(() => {
    if (page > totalPages) setPage(totalPages)
  }, [totalPages, page])

  const paged = useMemo(() => {
    const start = (page - 1) * pageSize
    return filtered.slice(start, start + pageSize)
  }, [filtered, page, pageSize])

  const grouped = useMemo(() => {
    const map = new Map<string, { vendor: string; jobs: Job[]; avatar: string; color: string }>()
    for (const j of paged) {
      const vname = j.vendor?.nama ?? 'Tanpa Vendor'
      if (!map.has(vname)) {
        const shortName = vname.split(' ').map(w => w[0]).join('').slice(0, 4).toUpperCase()
        map.set(vname, { 
          vendor: vname, 
          jobs: [], 
          avatar: shortName,
          color: VENDOR_COLORS[vname] ?? 'bg-slate-600'
        })
      }
      map.get(vname)!.jobs.push(j)
    }
    return Array.from(map.values())
  }, [paged])

  function toggleVendor(vendor: string) {
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(vendor)) next.delete(vendor)
      else next.add(vendor)
      return next
    })
  }

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function openNew() {
    setEditing(null)
    setForm(EMPTY_FORM)
    setModal(true)
  }

  function openEdit(j: Job) {
    setEditing(j)
    setForm({
      vendor_id: j.vendor_id ?? '',
      nama_project: j.nama_project,
      jenis_edit: j.jenis_edit,
      harga: j.harga,
      deadline: j.deadline ?? '',
      status_edit: j.status_edit,
      status_bayar: j.status_bayar,
      status_cetak: j.status_cetak,
      catatan: j.catatan ?? '',
    })
    setMenuFor(null)
    setModal(true)
  }

  async function deleteJob(j: Job) {
    setMenuFor(null)
    const { error } = await supabase.from('job').update({ deleted_at: new Date().toISOString() }).eq('id', j.id)
    if (error) {
      toast({ type: 'error', title: 'Gagal menghapus', message: error.message })
      return
    }
    toast({ type: 'success', title: 'Job dihapus' })
    loadData()
  }

  function toggleSelectAll(vendorJobs: Job[]) {
    setSelected((prev) => {
      const next = new Set(prev)
      const allSelected = vendorJobs.every((j) => next.has(j.id))
      for (const j of vendorJobs) {
        if (allSelected) next.delete(j.id)
        else next.add(j.id)
      }
      return next
    })
  }

  async function bulkMarkDone() {
    if (selected.size === 0) return
    const ids = Array.from(selected)
    const allDone = jobs.filter((j) => ids.includes(j.id)).every((j) => j.status_edit === 'Selesai')

    if (allDone) {
      for (const j of jobs.filter((j) => ids.includes(j.id))) {
        const prev = prevStatusRef.current[j.id]
        const { error } = await supabase.from('job')
          .update({
            status_edit: prev?.status_edit ?? 'Masuk',
            status_bayar: prev?.status_bayar ?? 'Belum Bayar',
            status_cetak: prev?.status_cetak ?? 'Belum Cetak',
            tanggal_lunas: null,
          })
          .eq('id', j.id)
        if (error) {
          toast({ type: 'error', title: 'Gagal mengembalikan', message: error.message })
          return
        }
        delete prevStatusRef.current[j.id]
      }
      toast({ type: 'success', title: `${ids.length} job dikembalikan ke status sebelumnya` })
    } else {
      for (const j of jobs.filter((j) => ids.includes(j.id))) {
        prevStatusRef.current[j.id] = {
          status_edit: j.status_edit,
          status_bayar: j.status_bayar,
          status_cetak: j.status_cetak,
        }
        const { error } = await supabase.from('job')
          .update({
            status_edit: 'Selesai',
            status_bayar: 'Lunas',
            status_cetak: 'Sudah Cetak',
            tanggal_lunas: new Date().toISOString().slice(0, 10),
          })
          .eq('id', j.id)
        if (error) {
          toast({ type: 'error', title: 'Gagal memperbarui', message: error.message })
          return
        }
      }
      toast({ type: 'success', title: `${ids.length} job ditandai Selesai & Lunas` })
    }

    setSelected(new Set())
    loadData()
  }

  async function bulkMarkLunas() {
    if (selected.size === 0) return
    const ids = Array.from(selected)
    const { error } = await supabase.from('job')
      .update({ status_bayar: 'Lunas', tanggal_lunas: new Date().toISOString().slice(0, 10) })
      .in('id', ids)
    if (error) {
      toast({ type: 'error', title: 'Gagal memperbarui', message: error.message })
      return
    }
    toast({ type: 'success', title: `${ids.length} job ditandai Lunas` })
    setSelected(new Set())
    loadData()
  }

  async function bulkMarkBelumLunas() {
    if (selected.size === 0) return
    const ids = Array.from(selected)
    const { error } = await supabase.from('job')
      .update({ status_bayar: 'Belum Bayar', tanggal_lunas: null })
      .in('id', ids)
    if (error) {
      toast({ type: 'error', title: 'Gagal memperbarui', message: error.message })
      return
    }
    toast({ type: 'success', title: `${ids.length} job ditandai Belum Lunas` })
    setSelected(new Set())
    loadData()
  }

  async function bulkDelete() {
    if (selected.size === 0) return
    const ids = Array.from(selected)
    const { error } = await supabase.from('job').update({ deleted_at: new Date().toISOString() }).in('id', ids)
    if (error) {
      toast({ type: 'error', title: 'Gagal menghapus', message: error.message })
      return
    }
    toast({ type: 'success', title: `${ids.length} job dihapus` })
    setSelected(new Set())
    loadData()
  }

  function deadlineLabel(deadline: string | null): { label: string; color: string; dot: string } {
    if (!deadline) return { label: '', color: '', dot: '' }
    const days = daysUntil(deadline)
    if (days < 0) return { label: 'Terlambat', color: 'text-red-600', dot: 'bg-red-600' }
    if (days === 0) return { label: 'Hari Ini', color: 'text-red-600', dot: 'bg-red-600' }
    if (days === 1) return { label: 'Besok', color: 'text-orange-600', dot: 'bg-orange-500' }
    if (days === 2) return { label: '2 Hari Lagi', color: 'text-yellow-600', dot: 'bg-yellow-500' }
    if (days === 3) return { label: '3 Hari Lagi', color: 'text-slate-600', dot: 'bg-slate-400' }
    return { label: '', color: 'text-slate-600', dot: 'bg-slate-300' }
  }

  async function saveJob(e: FormEvent) {
    e.preventDefault()
    if (!form.vendor_id || !form.nama_project) {
      toast({ type: 'error', title: 'Vendor dan nama project wajib diisi' })
      return
    }
    setSaving(true)
    const payload = { ...form, user_id: (await supabase.auth.getUser()).data.user?.id }
    const { error } = editing
      ? await supabase.from('job').update(payload).eq('id', editing.id)
      : await supabase.from('job').insert([payload])
    setSaving(false)
    if (error) {
      toast({ type: 'error', title: 'Gagal menyimpan', message: error.message })
      return
    }
    toast({ type: 'success', title: editing ? 'Job diperbarui' : 'Job ditambahkan' })
    setModal(false)
    loadData()
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
      <div className="flex items-center justify-end">
        <button onClick={openNew} className="btn-primary">
          <Plus className="w-4 h-4" /> Tambah Job
        </button>
      </div>

      {/* Search + Filters */}
      <div className="card p-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 flex-1 min-w-[200px]">
            <Search className="w-4 h-4 text-slate-400" />
            <input
              ref={searchRef}
              type="text"
              placeholder="Cari project / vendor..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1) }}
              className="flex-1 text-sm bg-transparent outline-none text-slate-900 placeholder:text-slate-400"
            />
            <kbd className="text-xs text-slate-400 border border-slate-200 rounded px-1.5 py-0.5">Ctrl + K</kbd>
          </div>
          <select value={filterStatus} onChange={(e) => { setFilterStatus(e.target.value); setPage(1) }} className="text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white">
            <option>Semua Status</option>
            {STATUS_EDIT_OPTIONS.map((s) => <option key={s}>{s}</option>)}
          </select>
          <select value={filterVendor} onChange={(e) => { setFilterVendor(e.target.value); setPage(1) }} className="text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white">
            <option>Semua Vendor</option>
            {vendors.map((v) => <option key={v.id}>{v.nama}</option>)}
          </select>
          <select value={filterJenis} onChange={(e) => { setFilterJenis(e.target.value); setPage(1) }} className="text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white">
            <option>Semua Jenis</option>
            {JENIS_EDIT_OPTIONS.map((j) => <option key={j}>{j}</option>)}
          </select>
          <div className="relative">
            <button
              onClick={() => deadlinePickerRef.current?.showPicker()}
              title="Filter berdasarkan deadline"
              className={`p-2 border rounded-lg bg-white hover:bg-slate-50 ${filterDeadline ? 'border-rose-300 text-rose-500' : 'border-slate-200 text-slate-600'}`}
            >
              <Calendar className="w-4 h-4" />
            </button>
            <input
              ref={deadlinePickerRef}
              type="date"
              value={filterDeadline}
              onChange={(e) => { setFilterDeadline(e.target.value); setPage(1) }}
              className="absolute inset-0 w-9 h-9 opacity-0 pointer-events-none"
              tabIndex={-1}
            />
            {filterDeadline && (
              <button
                onClick={() => setFilterDeadline('')}
                title="Hapus filter deadline"
                className="absolute -top-2 -right-2 w-4 h-4 rounded-full bg-rose-500 text-white text-[10px] flex items-center justify-center"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
          {(filterDeadline || search || filterStatus !== 'Semua Status' || filterVendor !== 'Semua Vendor' || filterJenis !== 'Semua Jenis') && (
            <button
              onClick={() => {
                setSearch('')
                setFilterStatus('Semua Status')
                setFilterVendor('Semua Vendor')
                setFilterJenis('Semua Jenis')
                setFilterDeadline('')
                setPage(1)
              }}
              className="text-xs text-rose-500 hover:text-rose-600 font-medium"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Job list grouped by vendor */}
      <div className="space-y-3">
        {grouped.map(({ vendor, jobs: vendorJobs, avatar, color }) => {
          const isCollapsed = collapsed.has(vendor)
          const totalJobs = vendorJobs.length
          const selesai = vendorJobs.filter((j) => j.status_edit === 'Selesai').length
          const belumSelesai = totalJobs - selesai
          const pct = totalJobs > 0 ? (selesai / totalJobs) * 100 : 0
          const outstanding = vendorJobs.filter((j) => j.status_bayar === 'Belum Bayar').reduce((sum, j) => sum + j.harga, 0)
          const countBelumBayar = vendorJobs.filter((j) => j.status_bayar === 'Belum Bayar').length

          return (
            <div key={vendor} className="card overflow-hidden">
              {/* Vendor header */}
              <div className="p-4 bg-slate-50/50">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full ${color} text-white flex items-center justify-center font-bold text-sm shrink-0`}>
                    {avatar}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-slate-900 truncate">{vendor}</p>
                    <div className="flex items-center gap-3 text-xs text-slate-600 mt-0.5">
                      <span className="flex items-center gap-1">📋 {totalJobs} Job</span>
                      <span className="flex items-center gap-1">✅ {selesai} Selesai</span>
                      <span className="flex items-center gap-1">⚠️ {belumSelesai} Belum Selesai</span>
                    </div>
                  </div>
                  <button onClick={() => toggleVendor(vendor)} className="p-1.5 hover:bg-slate-200 rounded-lg shrink-0">
                    {isCollapsed ? <ChevronDown className="w-5 h-5 text-slate-600" /> : <ChevronUp className="w-5 h-5 text-slate-600" />}
                  </button>
                </div>

                <div className="flex items-center gap-6 mt-3 pt-3 border-t border-slate-200/70">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-xs text-slate-500">{pct.toFixed(0)}% Selesai</p>
                      <p className="text-xs text-slate-500">{selesai} / {totalJobs} Job</p>
                    </div>
                    <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                      <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-xs text-slate-500">Outstanding</p>
                    <p className="text-base font-bold text-rose-600 leading-tight">{rupiah(outstanding)}</p>
                    <p className="text-xs text-slate-500">{countBelumBayar} Belum Bayar</p>
                  </div>
                </div>
              </div>

              {/* Job table */}
              {!isCollapsed && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50/30">
                        <th className="text-left py-2 px-4 font-medium text-slate-500 w-8">
                          <input
                            type="checkbox"
                            className="w-4 h-4 rounded border-slate-300 text-rose-500"
                            checked={vendorJobs.length > 0 && vendorJobs.every((j) => selected.has(j.id))}
                            onChange={() => toggleSelectAll(vendorJobs)}
                          />
                        </th>
                        <th className="text-left py-2 px-4 font-medium text-slate-500">Project</th>
                        <th className="text-left py-2 px-4 font-medium text-slate-500">Jenis</th>
                        <th className="text-left py-2 px-4 font-medium text-slate-500">Deadline</th>
                        <th className="text-left py-2 px-4 font-medium text-slate-500">Status</th>
                        <th className="text-left py-2 px-4 font-medium text-slate-500">Bayar</th>
                        <th className="text-left py-2 px-4 font-medium text-slate-500">Cetak</th>
                        <th className="text-left py-2 px-4 font-medium text-slate-500 w-16">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {vendorJobs.map((j) => {
                        const dl = deadlineLabel(j.deadline)
                        return (
                          <tr key={j.id} className="hover:bg-slate-50/50">
                            <td className="py-3 px-4">
                              <input
                                type="checkbox"
                                checked={selected.has(j.id)}
                                onChange={() => toggleSelect(j.id)}
                                className="w-4 h-4 rounded border-slate-300 text-rose-500"
                              />
                            </td>
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-2">
                                <Folder className="w-4 h-4 text-slate-400 shrink-0" />
                                <span className="font-medium text-slate-900">{j.nama_project}</span>
                              </div>
                            </td>
                            <td className="py-3 px-4">
                              <span className="text-blue-600 font-medium">{j.jenis_edit}</span>
                            </td>
                            <td className="py-3 px-4">
                              {j.deadline ? (
                                <div className="flex flex-col gap-0.5">
                                  {dl.label && (
                                    <div className="flex items-center gap-1.5">
                                      <div className={`w-2 h-2 rounded-full ${dl.dot}`} />
                                      <span className={`text-xs font-semibold ${dl.color}`}>{dl.label}</span>
                                    </div>
                                  )}
                                  <span className="text-slate-600 text-xs">{formatDate(j.deadline)}</span>
                                </div>
                              ) : (
                                <span className="text-slate-400">—</span>
                              )}
                            </td>
                            <td className="py-3 px-4">
                              <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold ${
                                j.status_edit === 'Masuk' ? 'bg-blue-100 text-blue-700' :
                                j.status_edit === 'Sedang Edit' ? 'bg-orange-100 text-orange-700' :
                                j.status_edit === 'Revisi' ? 'bg-purple-100 text-purple-700' :
                                'bg-emerald-100 text-emerald-700'
                              }`}>
                                {j.status_edit}
                              </span>
                            </td>
                            <td className="py-3 px-4">
                              {j.status_bayar === 'Belum Bayar' ? (
                                <span className="inline-flex px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-700">
                                  Belum Bayar
                                </span>
                              ) : (
                                <span className="text-slate-400">—</span>
                              )}
                            </td>
                            <td className="py-3 px-4">
                              <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold ${
                                j.status_cetak === 'Sudah Cetak' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'
                              }`}>
                                {j.status_cetak}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-center relative">
                              <button
                                onClick={() => setMenuFor(menuFor === j.id ? null : j.id)}
                                className="p-1 hover:bg-slate-200 rounded"
                              >
                                <MoreVertical className="w-4 h-4 text-slate-400" />
                              </button>
                              {menuFor === j.id && (
                                <>
                                  <div className="fixed inset-0 z-40" onClick={() => setMenuFor(null)} />
                                  <div className="absolute right-4 top-10 z-50 bg-white border border-slate-200 rounded-xl shadow-lg py-1 w-40">
                                    <button
                                      onClick={() => openEdit(j)}
                                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                                    >
                                      <Pencil className="w-4 h-4" /> Edit
                                    </button>
                                    <button
                                      onClick={() => deleteJob(j)}
                                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                                    >
                                      <Trash2 className="w-4 h-4" /> Hapus
                                    </button>
                                  </div>
                                </>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                  {vendorJobs.length > 5 && (
                    <div className="text-center py-3 border-t border-slate-100">
                      <button onClick={() => toggleVendor(vendor)} className="text-sm text-blue-600 hover:underline font-medium">
                        Tampilkan lebih sedikit ↑
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Bulk actions */}
      {selected.size > 0 && (
        <div className="sticky bottom-4 z-30 flex flex-wrap items-center gap-2 bg-white border border-slate-200 rounded-xl shadow-lg p-2">
          <span className="text-sm font-semibold text-slate-700 px-2">{selected.size} dipilih</span>
          <button onClick={bulkMarkDone} className="btn-primary !py-1.5 !px-3 text-xs">
            <CheckCircle2 className="w-4 h-4" /> Job Beres
          </button>
          <button onClick={bulkMarkLunas} className="inline-flex items-center gap-1 border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 text-xs font-semibold px-3 py-1.5 rounded-xl transition-colors">
            <Wallet className="w-4 h-4" /> Lunas
          </button>
          <button onClick={bulkMarkBelumLunas} className="inline-flex items-center gap-1 border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 text-xs font-semibold px-3 py-1.5 rounded-xl transition-colors">
            <CreditCard className="w-4 h-4" /> Belum Lunas
          </button>
          <button onClick={bulkDelete} className="inline-flex items-center gap-1 border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 text-xs font-semibold px-3 py-1.5 rounded-xl transition-colors">
            <Trash2 className="w-4 h-4" /> Hapus
          </button>
          <button onClick={() => setSelected(new Set())} className="ml-auto p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Footer pagination */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">
          Menampilkan {filtered.length === 0 ? 0 : (page - 1) * pageSize + 1} – {Math.min(page * pageSize, filtered.length)} dari {filtered.length} job
        </p>
        <div className="flex items-center gap-2">
          <select
            value={pageSize}
            onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1) }}
            className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 bg-white"
          >
            <option value={10}>10 / halaman</option>
            <option value={25}>25 / halaman</option>
            <option value={50}>50 / halaman</option>
          </select>
          <div className="flex items-center gap-1">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
              <button
                key={n}
                onClick={() => setPage(n)}
                className={`w-8 h-8 flex items-center justify-center rounded-lg font-semibold ${
                  n === page ? 'bg-rose-500 text-white' : 'border border-slate-200 hover:bg-slate-50'
                }`}
              >
                {n}
              </button>
            ))}
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="w-8 h-8 flex items-center justify-center border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40"
            >
              →
            </button>
          </div>
        </div>
      </div>

      {/* Modal */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <form onSubmit={saveJob} className="card p-5 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <h2 className="text-base font-bold text-slate-900 mb-4">{editing ? 'Edit Job' : 'Tambah Job'}</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Vendor</label>
                <select value={form.vendor_id} onChange={(e) => setForm({ ...form, vendor_id: e.target.value })} required className="input-base">
                  <option value="">Pilih vendor</option>
                  {vendors.map((v) => <option key={v.id} value={v.id}>{v.nama}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nama Project</label>
                <input type="text" value={form.nama_project} onChange={(e) => setForm({ ...form, nama_project: e.target.value })} required className="input-base" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Jenis Edit</label>
                  <select value={form.jenis_edit} onChange={(e) => setForm({ ...form, jenis_edit: e.target.value as JenisEdit })} className="input-base">
                    {JENIS_EDIT_OPTIONS.map((j) => <option key={j}>{j}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Harga</label>
                  <input type="number" value={form.harga} onChange={(e) => setForm({ ...form, harga: Number(e.target.value) })} className="input-base" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Deadline</label>
                <input type="date" value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} className="input-base" />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Status Edit</label>
                  <select value={form.status_edit} onChange={(e) => setForm({ ...form, status_edit: e.target.value as StatusEdit })} className="input-base">
                    {STATUS_EDIT_OPTIONS.map((s) => <option key={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Bayar</label>
                  <select value={form.status_bayar} onChange={(e) => setForm({ ...form, status_bayar: e.target.value as StatusBayar })} className="input-base">
                    {STATUS_BAYAR_OPTIONS.map((s) => <option key={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Cetak</label>
                  <select value={form.status_cetak} onChange={(e) => setForm({ ...form, status_cetak: e.target.value as StatusCetak })} className="input-base">
                    {STATUS_CETAK_OPTIONS.map((s) => <option key={s}>{s}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Catatan</label>
                <textarea value={form.catatan} onChange={(e) => setForm({ ...form, catatan: e.target.value })} rows={2} className="input-base resize-none" />
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button type="button" onClick={() => setModal(false)} className="flex-1 btn-secondary justify-center">Batal</button>
              <button type="submit" disabled={saving} className="flex-1 btn-primary justify-center">
                {saving ? 'Menyimpan...' : 'Simpan'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
