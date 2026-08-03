import { useEffect, useState, useMemo, useRef, type FormEvent } from 'react'
import { Plus, Search, Grid3x3, List, Phone, Pencil, MoreVertical, Trash2, X } from 'lucide-react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../lib/AuthContext'
import { useToast } from '../lib/ToastContext'
import type { Vendor, VendorPriceItem } from '../lib/types'
import { rupiah, formatRibuan, parseRibuan, validateWhatsApp } from '../lib/utils'

interface VendorStats extends Vendor {
  price_items?: VendorPriceItem[]
}

const EMPTY_FORM = {
  nama: '',
  whatsapp: '',
}

const MAX_PRODUCTS = 15

const VENDOR_COLORS = ['bg-orange-600', 'bg-purple-600', 'bg-slate-900', 'bg-pink-500', 'bg-blue-600', 'bg-teal-600', 'bg-indigo-600']

export default function Vendors() {
  const { user } = useAuth()
  const { toast, confirm } = useToast()
  const [vendors, setVendors] = useState<VendorStats[]>([])
  const [jobs, setJobs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('Semua Status')
  const [sortOrder, setSortOrder] = useState('A - Z')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState<VendorStats | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [priceItems, setPriceItems] = useState<{ nama_produk: string; harga: number }[]>([])
  const [saving, setSaving] = useState(false)
  const [menuFor, setMenuFor] = useState<string | null>(null)
  const searchRef = useRef<HTMLInputElement>(null)

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
    const [vRes, jRes, piRes] = await Promise.all([
      supabase.from('vendor').select('*').is('deleted_at', null).order('nama'),
      supabase.from('job').select('id, vendor_id, harga, status_edit, status_bayar').is('deleted_at', null),
      supabase.from('vendor_price_item').select('*').order('urutan'),
    ])
    if (vRes.data) {
      const priceByVendor = new Map<string, VendorPriceItem[]>()
      for (const pi of (piRes.data ?? []) as VendorPriceItem[]) {
        if (!priceByVendor.has(pi.vendor_id)) priceByVendor.set(pi.vendor_id, [])
        priceByVendor.get(pi.vendor_id)!.push(pi)
      }
      setVendors((vRes.data as Vendor[]).map((v) => ({ ...v, price_items: priceByVendor.get(v.id) ?? [] })))
    }
    if (jRes.data) setJobs(jRes.data)
    setLoading(false)
  }

  const vendorStats = useMemo(() => {
    const map = new Map<string, { jobCount: number; pendapatan: number; outstanding: number; selesai: number }>()
    for (const v of vendors) {
      map.set(v.id, { jobCount: 0, pendapatan: 0, outstanding: 0, selesai: 0 })
    }
    for (const j of jobs) {
      if (!j.vendor_id) continue
      const stats = map.get(j.vendor_id)
      if (!stats) continue
      stats.jobCount++
      if (j.status_bayar === 'Lunas') stats.pendapatan += j.harga
      else stats.outstanding += j.harga
      if (j.status_edit === 'Selesai') stats.selesai++
    }
    return map
  }, [vendors, jobs])

  const filtered = useMemo(() => {
    let result = vendors
    if (search) {
      const q = search.toLowerCase()
      result = result.filter((v) => v.nama.toLowerCase().includes(q) || v.whatsapp?.toLowerCase().includes(q))
    }
    if (filterStatus === 'Ada Piutang') {
      result = result.filter((v) => (vendorStats.get(v.id)?.outstanding ?? 0) > 0)
    } else if (filterStatus === 'Lunas Semua') {
      result = result.filter((v) => (vendorStats.get(v.id)?.outstanding ?? 0) === 0)
    }
    if (sortOrder === 'A - Z') result = [...result].sort((a, b) => a.nama.localeCompare(b.nama))
    else if (sortOrder === 'Z - A') result = [...result].sort((a, b) => b.nama.localeCompare(a.nama))
    return result
  }, [vendors, search, filterStatus, sortOrder, vendorStats])

  const totalStats = useMemo(() => {
    let totalJob = 0
    let totalPendapatan = 0
    let totalOutstanding = 0
    let totalSelesai = 0
    for (const stats of vendorStats.values()) {
      totalJob += stats.jobCount
      totalPendapatan += stats.pendapatan
      totalOutstanding += stats.outstanding
      totalSelesai += stats.selesai
    }
    const rataSelesai = totalJob > 0 ? (totalSelesai / totalJob) * 100 : 0
    return { totalJob, totalPendapatan, totalOutstanding, rataSelesai }
  }, [vendorStats])

  function openNew() {
    setEditing(null)
    setForm(EMPTY_FORM)
    setPriceItems([])
    setModal(true)
  }

  function openEdit(vendor: VendorStats) {
    setEditing(vendor)
    setForm({
      nama: vendor.nama,
      whatsapp: vendor.whatsapp ?? '',
    })
    setPriceItems(
      (vendor.price_items ?? []).map((pi) => ({ nama_produk: pi.nama_produk, harga: pi.harga }))
    )
    setModal(true)
  }

  function addPriceItem() {
    setPriceItems((prev) => [...prev, { nama_produk: '', harga: 0 }])
  }

  function removePriceItem(idx: number) {
    setPriceItems((prev) => prev.filter((_, i) => i !== idx))
  }

  function updatePriceItem(idx: number, field: 'nama_produk' | 'harga', value: string | number) {
    setPriceItems((prev) => {
      const next = [...prev]
      next[idx] = { ...next[idx], [field]: value }
      return next
    })
  }

  async function syncPriceItems(vendorId: string, items: { nama_produk: string; harga: number }[]) {
    if (!user) throw new Error('Session tidak valid.')

    const { error: delErr } = await supabase
      .from('vendor_price_item')
      .delete()
      .eq('vendor_id', vendorId)
      .eq('user_id', user.id)
    if (delErr) throw new Error('Gagal hapus produk lama: ' + delErr.message)

    if (items.length === 0) return

    const { error: insErr } = await supabase.from('vendor_price_item').insert(
      items.map((item, idx) => ({
        vendor_id: vendorId,
        user_id: user.id,
        nama_produk: item.nama_produk,
        harga: item.harga,
        urutan: idx,
      }))
    )
    if (insErr) throw new Error('Gagal simpan produk: ' + insErr.message)
  }

  async function saveVendor(e: FormEvent) {
    e.preventDefault()
    if (!user) {
      toast({ type: 'error', title: 'Session tidak valid', message: 'Silakan refresh halaman.' })
      return
    }
    if (!form.nama.trim()) {
      toast({ type: 'error', title: 'Nama vendor wajib diisi' })
      return
    }
    if (form.whatsapp.trim() && !validateWhatsApp(form.whatsapp)) {
      toast({ type: 'error', title: 'Nomor WhatsApp tidak valid', message: 'Gunakan 10–15 digit angka.' })
      return
    }
    const validItems = priceItems.filter((p) => p.nama_produk.trim())
    if (validItems.length > MAX_PRODUCTS) {
      toast({ type: 'error', title: 'Terlalu banyak produk', message: `Maksimal ${MAX_PRODUCTS} produk per vendor.` })
      return
    }
    setSaving(true)

    const payload = {
      user_id: user.id,
      nama: form.nama.trim(),
      whatsapp: form.whatsapp.trim() || null,
      updated_at: new Date().toISOString(),
    }

    let vendorId: string | null = editing?.id ?? null
    let error: any

    if (editing) {
      ;({ error } = await supabase.from('vendor').update(payload).eq('id', editing.id))
    } else {
      const { data, error: insErr } = await supabase.from('vendor').insert(payload).select('id').single()
      error = insErr
      if (data) vendorId = data.id
    }

    if (error) {
      toast({ type: 'error', title: 'Gagal menyimpan vendor', message: error.message })
      setSaving(false)
      return
    }

    if (vendorId) {
      try {
        await syncPriceItems(vendorId, validItems)
      } catch (syncErr: any) {
        toast({ type: 'error', title: 'Gagal menyimpan daftar produk', message: syncErr?.message })
        setSaving(false)
        return
      }
    }

    toast({ type: 'success', title: editing ? 'Vendor diperbarui' : 'Vendor ditambahkan' })
    setModal(false)
    await loadData()
    setSaving(false)
  }

  async function deleteVendor(vendor: Vendor) {
    const { count, error: countErr } = await supabase
      .from('job')
      .select('*', { count: 'exact', head: true })
      .is('deleted_at', null)
      .eq('vendor_id', vendor.id)
    if (countErr) {
      toast({ type: 'error', title: 'Gagal cek job vendor', message: countErr.message })
      return
    }
    if ((count ?? 0) > 0) {
      toast({
        type: 'error',
        title: 'Vendor masih memiliki job aktif',
        message: `${count} job masih terkait. Pindahkan/hapus job dulu.`,
      })
      return
    }
    const ok = await confirm({ title: 'Hapus vendor ini?', message: `"${vendor.nama}" akan dipindahkan ke Recycle Bin.`, confirmLabel: 'Hapus', danger: true })
    if (!ok) return
    const { error } = await supabase.from('vendor').update({ deleted_at: new Date().toISOString() }).eq('id', vendor.id)
    if (error) {
      toast({ type: 'error', title: 'Gagal menghapus', message: error.message })
      return
    }
    toast({ type: 'success', title: 'Vendor dihapus' })
    setMenuFor(null)
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
          <Plus className="w-4 h-4" /> Tambah Vendor
        </button>
      </div>

      {/* Search + Filters + View Toggle */}
      <div className="card p-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 flex-1 min-w-[200px]">
            <Search className="w-4 h-4 text-slate-400" />
            <input
              ref={searchRef}
              type="text"
              placeholder="Cari vendor..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 text-sm bg-transparent outline-none text-slate-900 placeholder:text-slate-400"
            />
            <kbd className="text-xs text-slate-400 border border-slate-200 rounded px-1.5 py-0.5">Ctrl + K</kbd>
          </div>
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white">
            <option>Semua Status</option>
            <option>Ada Piutang</option>
            <option>Lunas Semua</option>
          </select>
          <select value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} className="text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white">
            <option>Urutkan: A - Z</option>
            <option>Urutkan: Z - A</option>
          </select>
          <div className="flex items-center gap-1 border border-slate-200 rounded-lg p-1">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded ${viewMode === 'grid' ? 'bg-rose-500 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
            >
              <Grid3x3 className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded ${viewMode === 'list' ? 'bg-rose-500 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Vendor Grid */}
      <div className={`${viewMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4' : 'space-y-3'}`}>
        {filtered.map((v, idx) => {
          const stats = vendorStats.get(v.id) ?? { jobCount: 0, pendapatan: 0, outstanding: 0, selesai: 0 }
          const pct = stats.jobCount > 0 ? (stats.selesai / stats.jobCount) * 100 : 0
          const color = VENDOR_COLORS[idx % VENDOR_COLORS.length]
          const initials = v.nama.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
          const priceItems = v.price_items ?? []

          if (viewMode === 'list') {
            return (
              <div key={v.id} className="card p-4 hover:shadow-md transition-shadow">
                <div className="flex flex-wrap items-center gap-4">
                  <div className={`w-10 h-10 rounded-full ${color} text-white flex items-center justify-center font-bold text-sm shrink-0`}>
                    {initials}
                  </div>
                  <div className="flex-1 min-w-[160px]">
                    <h3 className="font-bold text-slate-900 truncate">{v.nama}</h3>
                    {v.whatsapp && (
                      <div className="flex items-center gap-1 text-xs text-slate-500 mt-0.5">
                        <Phone className="w-3 h-3" />
                        <span>{v.whatsapp}</span>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-6 text-center">
                    <div>
                      <div className="text-lg font-bold text-blue-600">{stats.jobCount}</div>
                      <div className="text-xs text-slate-500">Job</div>
                    </div>
                    <div>
                      <div className="text-sm font-bold text-emerald-600">{rupiah(stats.pendapatan)}</div>
                      <div className="text-xs text-slate-500">Pendapatan</div>
                    </div>
                    <div>
                      <div className="text-sm font-bold text-orange-600">{rupiah(stats.outstanding)}</div>
                      <div className="text-xs text-slate-500">Piutang</div>
                    </div>
                    <div className="w-28">
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="text-slate-600">{pct.toFixed(0)}%</span>
                        <span className="text-slate-600">{stats.selesai} / {stats.jobCount}</span>
                      </div>
                      <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => openEdit(v)} className="p-1 hover:bg-slate-100 rounded">
                      <Pencil className="w-4 h-4 text-slate-400" />
                    </button>
                    <button onClick={() => deleteVendor(v)} className="p-1 hover:bg-slate-100 rounded">
                      <Trash2 className="w-4 h-4 text-red-400" />
                    </button>
                  </div>
                </div>
                {priceItems.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t border-slate-100">
                    {priceItems.slice(0, 4).map((pi) => (
                      <span key={pi.id} className="text-xs text-slate-600 bg-slate-50 border border-slate-100 rounded-full px-2 py-0.5">
                        {pi.nama_produk}: {rupiah(pi.harga)}
                      </span>
                    ))}
                    {priceItems.length > 4 && (
                      <span className="text-xs text-slate-400 italic">+{priceItems.length - 4} lainnya</span>
                    )}
                  </div>
                )}
              </div>
            )
          }

          return (
            <div key={v.id} className="card p-4 hover:shadow-md transition-shadow">
              {/* Header */}
              <div className="flex items-start gap-3 mb-4">
                <div className={`w-11 h-11 rounded-full ${color} text-white flex items-center justify-center font-bold text-sm shrink-0`}>
                  {initials}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-slate-900 truncate">{v.nama}</h3>
                  {v.whatsapp && (
                    <div className="flex items-center gap-1 text-xs text-slate-500 mt-0.5">
                      <Phone className="w-3 h-3" />
                      <span>{v.whatsapp}</span>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => openEdit(v)} className="p-1 hover:bg-slate-100 rounded">
                    <Pencil className="w-4 h-4 text-slate-400" />
                  </button>
                  <div className="relative">
                    <button onClick={() => setMenuFor(menuFor === v.id ? null : v.id)} className="p-1 hover:bg-slate-100 rounded">
                      <MoreVertical className="w-4 h-4 text-slate-400" />
                    </button>
                    {menuFor === v.id && (
                      <>
                        <div className="fixed inset-0 z-40" onClick={() => setMenuFor(null)} />
                        <div className="absolute right-0 top-9 z-50 bg-white border border-slate-200 rounded-xl shadow-lg py-1 w-40">
                          <button
                            onClick={() => { openEdit(v); setMenuFor(null) }}
                            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                          >
                            <Pencil className="w-4 h-4" /> Edit
                          </button>
                          <button
                            onClick={() => deleteVendor(v)}
                            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                          >
                            <Trash2 className="w-4 h-4" /> Hapus
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-2 mb-4">
                <div className="text-center">
                  <div className="text-lg font-bold text-blue-600">{stats.jobCount}</div>
                  <div className="text-xs text-slate-500">Job</div>
                </div>
                <div className="text-center">
                  <div className="text-sm font-bold text-emerald-600">{rupiah(stats.pendapatan)}</div>
                  <div className="text-xs text-slate-500">Pendapatan</div>
                </div>
                <div className="text-center">
                  <div className="text-sm font-bold text-orange-600">{rupiah(stats.outstanding)}</div>
                  <div className="text-xs text-slate-500">Piutang</div>
                </div>
              </div>

              {/* Progress */}
              <div className="mb-4">
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="text-slate-600">{pct.toFixed(0)}% Selesai</span>
                  <span className="text-slate-600">{stats.selesai} / {stats.jobCount} Job</span>
                </div>
                <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                </div>
              </div>

              {/* Price items */}
              <div className="text-xs text-slate-500 space-y-1 border-t border-slate-100 pt-3">
                {priceItems.length > 0 ? (
                  <>
                    {priceItems.slice(0, 3).map((pi) => (
                      <div key={pi.id} className="flex items-center justify-between gap-2">
                        <span className="truncate">{pi.nama_produk}</span>
                        <span className="font-semibold text-slate-700 shrink-0">{rupiah(pi.harga)}</span>
                      </div>
                    ))}
                    {priceItems.length > 3 && (
                      <p className="italic text-slate-400">+{priceItems.length - 3} lainnya</p>
                    )}
                  </>
                ) : (
                  <p className="italic text-slate-400">Belum ada produk</p>
                )}
              </div>
            </div>
          )
        })}

        {/* Empty state / Add button */}
        {filtered.length < 6 && (
          <div className="card p-8 flex flex-col items-center justify-center text-center border-dashed hover:border-rose-300 hover:bg-rose-50/30 cursor-pointer transition-colors" onClick={openNew}>
            <div className="w-16 h-16 rounded-full bg-rose-100 text-rose-500 flex items-center justify-center mb-3">
              <Plus className="w-8 h-8" />
            </div>
            <h3 className="font-bold text-slate-900 mb-1">Tambah Vendor</h3>
            <p className="text-sm text-slate-500 mb-3">Kelola vendor baru dengan mudah</p>
            <button className="text-sm text-rose-600 hover:text-rose-700 font-medium flex items-center gap-1">
              <Plus className="w-4 h-4" /> Tambah Vendor
            </button>
          </div>
        )}
      </div>

      {/* Footer Stats */}
      <div className="card p-5">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-6">
          <div>
            <p className="text-sm text-slate-500 mb-1">Total Vendor</p>
            <p className="text-lg font-bold text-slate-900">{vendors.length} vendor</p>
          </div>
          <div>
            <p className="text-sm text-slate-500 mb-1">Total Job</p>
            <p className="text-lg font-bold text-slate-900">{totalStats.totalJob} Job</p>
          </div>
          <div>
            <p className="text-sm text-slate-500 mb-1">Total Pendapatan</p>
            <p className="text-lg font-bold text-emerald-600">{rupiah(totalStats.totalPendapatan)}</p>
          </div>
          <div>
            <p className="text-sm text-slate-500 mb-1">Total Piutang</p>
            <p className="text-lg font-bold text-rose-600">{rupiah(totalStats.totalOutstanding)}</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="relative w-16 h-16">
              <svg className="w-16 h-16 transform -rotate-90">
                <circle cx="32" cy="32" r="28" fill="none" stroke="#e2e8f0" strokeWidth="6" />
                <circle
                  cx="32"
                  cy="32"
                  r="28"
                  fill="none"
                  stroke="#3b82f6"
                  strokeWidth="6"
                  strokeDasharray={`${28 * 2 * Math.PI * (totalStats.rataSelesai / 100)} ${28 * 2 * Math.PI}`}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-base font-bold text-slate-900">{totalStats.rataSelesai.toFixed(0)}%</span>
              </div>
            </div>
            <div>
              <p className="text-sm text-slate-500">Rata-rata Selesai</p>
            </div>
          </div>
        </div>
      </div>

      {/* Modal */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/50 backdrop-blur-sm p-0 sm:p-4">
          <div className="bg-white w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 sticky top-0 bg-white z-10">
              <h2 className="text-base font-bold text-slate-900">{editing ? 'Edit Vendor' : 'Tambah Vendor'}</h2>
              <button onClick={() => setModal(false)} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={saveVendor} className="p-5 space-y-4 pb-16 sm:pb-5">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nama Vendor</label>
                <input type="text" value={form.nama} onChange={(e) => setForm({ ...form, nama: e.target.value })} required className="input-base" placeholder="Nama studio / vendor" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">WhatsApp</label>
                <input type="text" value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} className="input-base" placeholder="08xx xxxx xxxx" />
              </div>

              {/* Dynamic price items */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-sm font-medium text-slate-700">Daftar Produk / Harga</label>
                </div>
                <div className="space-y-2">
                  {priceItems.map((item, idx) => (
                    <div key={idx} className="flex gap-2 items-start">
                      <input
                        value={item.nama_produk}
                        onChange={(e) => updatePriceItem(idx, 'nama_produk', e.target.value)}
                        placeholder="Nama produk (contoh: Kolase 3x4)"
                        className="flex-1 min-w-0 input-base-nofull"
                      />
                      <input
                        type="text"
                        inputMode="numeric"
                        value={item.harga ? formatRibuan(item.harga) : ''}
                        onChange={(e) => updatePriceItem(idx, 'harga', parseRibuan(e.target.value))}
                        placeholder="Harga"
                        className="w-28 shrink-0 input-base-nofull"
                      />
                      <button type="button" onClick={() => removePriceItem(idx)} className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg shrink-0">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={addPriceItem}
                  disabled={priceItems.length >= MAX_PRODUCTS}
                  className={`mt-2 flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors ${
                    priceItems.length >= MAX_PRODUCTS
                      ? 'text-slate-300 cursor-not-allowed'
                      : 'text-rose-600 hover:bg-rose-50'
                  }`}
                >
                  <Plus className="w-3 h-3" /> Tambah Produk
                  {priceItems.length >= MAX_PRODUCTS && ' (maksimal 15)'}
                </button>
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setModal(false)} className="flex-1 btn-secondary justify-center">Batal</button>
                <button type="submit" disabled={saving} className="flex-1 btn-primary justify-center">
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
