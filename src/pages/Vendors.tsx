import { useEffect, useState, type FormEvent } from 'react'
import { Plus, Pencil, Trash2, X, Phone } from 'lucide-react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../lib/AuthContext'
import type { Vendor, VendorPriceItem } from '../lib/types'
import { rupiah, validateWhatsApp } from '../lib/utils'

interface VendorStats extends Vendor {
  total_job: number
  total_pendapatan: number
  total_piutang: number
  price_items?: VendorPriceItem[]
}

const EMPTY_VENDOR = {
  nama: '',
  whatsapp: '',
}

const MAX_PRODUCTS = 15

export default function Vendors() {
  const { user } = useAuth()
  const [vendors, setVendors] = useState<VendorStats[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState<VendorStats | null>(null)
  const [form, setForm] = useState(EMPTY_VENDOR)
  const [priceItems, setPriceItems] = useState<{ nama_produk: string; harga: number }[]>([])
  const [saving, setSaving] = useState(false)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    setLoading(true)

    const [vRes, jRes, piRes] = await Promise.all([
      supabase.from('vendor').select('*').is('deleted_at', null).order('nama'),
      supabase.from('job').select('vendor_id, harga, status_bayar').is('deleted_at', null),
      supabase.from('vendor_price_item').select('*').order('urutan'),
    ])

    const jobs = (jRes.data ?? []) as { vendor_id: string | null; harga: number; status_bayar: string }[]
    const statsMap = new Map<string, { total_job: number; total_pendapatan: number; total_piutang: number }>()
    for (const j of jobs) {
      if (!j.vendor_id) continue
      if (!statsMap.has(j.vendor_id)) statsMap.set(j.vendor_id, { total_job: 0, total_pendapatan: 0, total_piutang: 0 })
      const s = statsMap.get(j.vendor_id)!
      s.total_job++
      if (j.status_bayar === 'Lunas') s.total_pendapatan += j.harga
      else s.total_piutang += j.harga
    }

    const priceByVendor = new Map<string, VendorPriceItem[]>()
    for (const pi of (piRes.data ?? []) as VendorPriceItem[]) {
      if (!priceByVendor.has(pi.vendor_id)) priceByVendor.set(pi.vendor_id, [])
      priceByVendor.get(pi.vendor_id)!.push(pi)
    }

    const list = ((vRes.data ?? []) as Vendor[]).map((v) => ({
      ...v,
      ...(statsMap.get(v.id) ?? { total_job: 0, total_pendapatan: 0, total_piutang: 0 }),
      price_items: priceByVendor.get(v.id) ?? [],
    }))
    setVendors(list)
    setLoading(false)
  }

  function openNew() {
    setEditing(null)
    setForm(EMPTY_VENDOR)
    setPriceItems([])
    setModal(true)
  }

  async function openEdit(v: VendorStats) {
    setEditing(v)
    setForm({
      nama: v.nama,
      whatsapp: v.whatsapp ?? '',
    })
    setPriceItems(
      (v.price_items ?? []).map((pi) => ({ nama_produk: pi.nama_produk, harga: pi.harga }))
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
    if (!user) return

    // Get existing items from DB for this vendor
    const { data: existing } = await supabase
      .from('vendor_price_item')
      .select('id, nama_produk, harga')
      .eq('vendor_id', vendorId)

    const existingMap = new Map<string, VendorPriceItem>()
    for (const e of (existing ?? []) as VendorPriceItem[]) {
      existingMap.set(e.id, e)
    }

    // Determine what to delete, update, insert
    const deleteIds: string[] = []
    const newItems: { nama_produk: string; harga: number; urutan: number }[] = []

    // If we loaded existing items, match by position
    const oldItems = (existing ?? []) as VendorPriceItem[]

    for (let i = 0; i < items.length; i++) {
      const item = items[i]
      // Try to match by index to existing (since we loaded in order)
      if (i < oldItems.length) {
        const old = oldItems[i]
        if (item.nama_produk !== old.nama_produk || item.harga !== old.harga) {
          await supabase.from('vendor_price_item').update({
            nama_produk: item.nama_produk,
            harga: item.harga,
            urutan: i,
          }).eq('id', old.id)
        }
      } else {
        newItems.push({ nama_produk: item.nama_produk, harga: item.harga, urutan: i })
      }
    }

    // Items beyond the new length should be deleted
    if (items.length < oldItems.length) {
      for (let i = items.length; i < oldItems.length; i++) {
        deleteIds.push(oldItems[i].id)
      }
    }

    if (deleteIds.length > 0) {
      await supabase.from('vendor_price_item').delete().in('id', deleteIds)
    }
    if (newItems.length > 0) {
      await supabase.from('vendor_price_item').insert(
        newItems.map((n) => ({ ...n, vendor_id: vendorId, user_id: user.id }))
      )
    }
  }

  async function saveVendor(e: FormEvent) {
    e.preventDefault()
    if (!user) return alert('Session tidak valid. Sila refresh halaman.')
    if (!form.nama.trim()) return alert('Nama vendor wajib diisi.')
    if (form.whatsapp && !validateWhatsApp(form.whatsapp)) {
      return alert('Nomor WhatsApp tidak valid (10–15 digit).')
    }
    const validItems = priceItems.filter((p) => p.nama_produk.trim())
    if (validItems.length > MAX_PRODUCTS) {
      return alert(`Maksimal ${MAX_PRODUCTS} produk per vendor.`)
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
      alert('Gagal menyimpan vendor: ' + error.message)
      setSaving(false)
      return
    }

    // Sync price items
    if (vendorId) {
      await syncPriceItems(vendorId, validItems)
    }

    setModal(false)
    await loadData()
    setSaving(false)
  }

  async function softDelete(v: VendorStats) {
    const { count, error: countErr } = await supabase
      .from('job')
      .select('*', { count: 'exact', head: true })
      .is('deleted_at', null)
      .eq('vendor_id', v.id)
    if (countErr) return alert('Gagal cek job vendor: ' + countErr.message)
    if ((count ?? 0) > 0) return alert(`Vendor masih memiliki ${count} job aktif. Pindahkan/hapus job dulu.`)
    if (!confirm(`Hapus vendor "${v.nama}"?`)) return
    const { error } = await supabase
      .from('vendor')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', v.id)
      .eq('user_id', user!.id)
    if (error) { alert('Gagal hapus: ' + error.message); return }
    await loadData()
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
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Vendor</h1>
          <p className="text-sm text-slate-500">{vendors.length} vendor</p>
        </div>
        <button onClick={openNew} className="flex items-center gap-1.5 bg-rose-600 hover:bg-rose-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
          <Plus className="w-4 h-4" /> Tambah
        </button>
      </div>

      {vendors.length === 0 ? (
        <div className="text-center py-16 text-slate-400 text-sm">Belum ada vendor. Klik Tambah untuk mulai.</div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {vendors.map((v) => (
            <div key={v.id} className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-slate-800">{v.nama}</h3>
                  {v.whatsapp && (
                    <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                      <Phone className="w-3 h-3" /> {v.whatsapp}
                    </p>
                  )}
                </div>
                <div className="flex gap-1">
                  <button onClick={() => openEdit(v)} className="p-1.5 text-slate-400 hover:text-blue-600"><Pencil className="w-3.5 h-3.5" /></button>
                  <button onClick={() => softDelete(v)} className="p-1.5 text-slate-400 hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-slate-50 rounded-lg py-2">
                  <p className="text-lg font-bold text-slate-800">{v.total_job}</p>
                  <p className="text-[10px] text-slate-400">Job</p>
                </div>
                <div className="bg-emerald-50 rounded-lg py-2">
                  <p className="text-xs font-bold text-emerald-700 truncate px-1">{rupiah(v.total_pendapatan)}</p>
                  <p className="text-[10px] text-slate-400">Pendapatan</p>
                </div>
                <div className="bg-amber-50 rounded-lg py-2">
                  <p className="text-xs font-bold text-amber-700 truncate px-1">{rupiah(v.total_piutang)}</p>
                  <p className="text-[10px] text-slate-400">Piutang</p>
                </div>
              </div>

              {/* Price items */}
              <div className="text-xs text-slate-400 space-y-0.5 border-t border-slate-100 pt-2">
                {v.price_items && v.price_items.length > 0 ? (
                  v.price_items.slice(0, 3).map((pi) => (
                    <p key={pi.id}>{pi.nama_produk}: {rupiah(pi.harga)}</p>
                  )).concat(
                    v.price_items.length > 3 ? (
                      <p key="more" className="text-slate-400 italic">+{v.price_items.length - 3} lainnya</p>
                    ) : <></>
                  )
                ) : (
                  <p className="text-slate-400 italic">Belum ada produk</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {modal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4">
          <div className="bg-white w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 sticky top-0 bg-white">
              <h2 className="font-semibold text-slate-800">{editing ? 'Edit Vendor' : 'Tambah Vendor'}</h2>
              <button onClick={() => setModal(false)} className="p-1 text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={saveVendor} className="p-5 space-y-4 pb-16 sm:pb-5">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Nama Vendor</label>
                <input required value={form.nama} onChange={(e) => setForm({ ...form, nama: e.target.value })} className={inputCls} placeholder="Nama studio / vendor" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">WhatsApp</label>
                <input value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} className={inputCls} placeholder="08xxxxxxxxxx" />
              </div>

              {/* Dynamic price items */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-medium text-slate-600">Daftar Produk / Harga</label>
                </div>
                <div className="space-y-2">
                  {priceItems.map((item, idx) => (
                    <div key={idx} className="flex gap-2 items-start">
                      <input
                        value={item.nama_produk}
                        onChange={(e) => updatePriceItem(idx, 'nama_produk', e.target.value)}
                        placeholder="Nama produk (contoh: Kolase 3x4)"
                        className={`flex-1 ${inputCls}`}
                      />
                      <input
                        type="number"
                        min={0}
                        value={item.harga}
                        onChange={(e) => updatePriceItem(idx, 'harga', Number(e.target.value))}
                        placeholder="Harga"
                        className={`w-28 ${inputCls}`}
                      />
                      <button type="button" onClick={() => removePriceItem(idx)} className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg">
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
