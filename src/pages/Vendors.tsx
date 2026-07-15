import { useEffect, useState, type FormEvent } from 'react'
import { Plus, Pencil, Trash2, X, Phone } from 'lucide-react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../lib/AuthContext'
import type { Vendor } from '../lib/types'
import { rupiah, validateWhatsApp } from '../lib/utils'

interface VendorStats extends Vendor {
  total_job: number
  total_pendapatan: number
  total_piutang: number
}

const EMPTY = {
  nama: '',
  whatsapp: '',
  harga_kolase_sudah_pilih: 35000,
  harga_kolase_belum_pilih: 50000,
  harga_edit_full: 135000,
}

export default function Vendors() {
  const { user } = useAuth()
  const [vendors, setVendors] = useState<VendorStats[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState<Vendor | null>(null)
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    setLoading(true)

    const [vRes, jRes] = await Promise.all([
      supabase.from('vendor').select('*').is('deleted_at', null).order('nama'),
      // Only fetch minimal columns needed for aggregation — no joins, no text
      supabase.from('job').select('vendor_id, harga, status_bayar').is('deleted_at', null),
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

    const list = ((vRes.data ?? []) as Vendor[]).map((v) => ({
      ...v,
      ...(statsMap.get(v.id) ?? { total_job: 0, total_pendapatan: 0, total_piutang: 0 }),
    }))
    setVendors(list)
    setLoading(false)
  }

  function openNew() {
    setEditing(null)
    setForm(EMPTY)
    setModal(true)
  }

  function openEdit(v: Vendor) {
    setEditing(v)
    setForm({
      nama: v.nama,
      whatsapp: v.whatsapp ?? '',
      harga_kolase_sudah_pilih: v.harga_kolase_sudah_pilih,
      harga_kolase_belum_pilih: v.harga_kolase_belum_pilih,
      harga_edit_full: v.harga_edit_full,
    })
    setModal(true)
  }

  async function saveVendor(e: FormEvent) {
    e.preventDefault()
    if (!user) return alert('Session tidak valid. Sila refresh halaman.')
    if (!form.nama.trim()) return alert('Nama vendor wajib diisi.')
    if (form.whatsapp && !validateWhatsApp(form.whatsapp)) {
      return alert('Nomor WhatsApp tidak valid (10–15 digit).')
    }
    setSaving(true)

    const payload = {
      user_id: user.id,
      nama: form.nama.trim(),
      whatsapp: form.whatsapp.trim() || null,
      harga_kolase_sudah_pilih: form.harga_kolase_sudah_pilih,
      harga_kolase_belum_pilih: form.harga_kolase_belum_pilih,
      harga_edit_full: form.harga_edit_full,
      updated_at: new Date().toISOString(),
    }

    let error
    if (editing) {
      ;({ error } = await supabase.from('vendor').update(payload).eq('id', editing.id))
    } else {
      ;({ error } = await supabase.from('vendor').insert(payload))
    }

    if (error) alert('Gagal menyimpan: ' + error.message)
    else {
      setModal(false)
      await loadData()
    }
    setSaving(false)
  }

  async function softDelete(v: VendorStats) {
    if (v.total_job > 0) {
      return alert(`Vendor masih memiliki ${v.total_job} job aktif. Pindahkan/hapus job dulu.`)
    }
    if (!confirm(`Hapus vendor "${v.nama}"?`)) return
    const { error } = await supabase
      .from('vendor')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', v.id)
      .eq('user_id', user!.id)
    if (error) {
      alert('Gagal hapus: ' + error.message)
      return
    }
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

              <div className="text-xs text-slate-400 space-y-0.5 border-t border-slate-100 pt-2">
                <p>Kolase Sudah: {rupiah(v.harga_kolase_sudah_pilih)}</p>
                <p>Kolase Belum: {rupiah(v.harga_kolase_belum_pilih)}</p>
                <p>Edit Full: {rupiah(v.harga_edit_full)}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {modal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4">
          <div className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl shadow-xl max-h-[90vh] overflow-y-auto">
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
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Harga Kolase Sudah Pilih</label>
                <input type="number" min={0} value={form.harga_kolase_sudah_pilih} onChange={(e) => setForm({ ...form, harga_kolase_sudah_pilih: Number(e.target.value) })} className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Harga Kolase Belum Pilih</label>
                <input type="number" min={0} value={form.harga_kolase_belum_pilih} onChange={(e) => setForm({ ...form, harga_kolase_belum_pilih: Number(e.target.value) })} className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Harga Edit Full</label>
                <input type="number" min={0} value={form.harga_edit_full} onChange={(e) => setForm({ ...form, harga_edit_full: Number(e.target.value) })} className={inputCls} />
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