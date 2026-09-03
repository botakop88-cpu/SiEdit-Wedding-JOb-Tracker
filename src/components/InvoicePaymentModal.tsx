import { useEffect, useState } from 'react'
import { X, Wallet, RotateCcw } from 'lucide-react'
import { useToast } from '../lib/ToastContext'
import type { Invoice, InvoicePayment } from '../lib/types'
import { rupiah, formatDate, todayStr, parseRibuan, formatRibuan } from '../lib/utils'
import { recordInvoicePayment, getInvoicePayments, reverseInvoicePayments } from '../lib/payments'

interface Props {
  invoice: Invoice
  onClose: () => void
  onChanged: () => void
}

export default function InvoicePaymentModal({ invoice, onClose, onChanged }: Props) {
  const { toast, confirm } = useToast()
  const [payments, setPayments] = useState<InvoicePayment[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [jumlahText, setJumlahText] = useState('')
  const [tanggal, setTanggal] = useState(todayStr())
  const [catatan, setCatatan] = useState('')

  useEffect(() => { load() }, [invoice.id])

  async function load() {
    setLoading(true)
    try {
      setPayments(await getInvoicePayments(invoice.id))
    } catch (err) {
      toast({ type: 'error', title: 'Gagal memuat riwayat', message: (err as Error).message })
    } finally {
      setLoading(false)
    }
  }

  const totalDibayar = payments.reduce((s, p) => s + p.jumlah, 0)
  const sisa = Math.max(0, invoice.total - totalDibayar)

  async function submitPayment(e: React.FormEvent) {
    e.preventDefault()
    const jumlah = parseRibuan(jumlahText)
    if (jumlah <= 0) {
      toast({ type: 'error', title: 'Jumlah pembayaran harus lebih dari 0' })
      return
    }
    if (jumlah > sisa) {
      toast({ type: 'error', title: 'Jumlah melebihi sisa tagihan', message: `Sisa tagihan invoice cuma ${rupiah(sisa)}.` })
      return
    }
    setSaving(true)
    try {
      await recordInvoicePayment(invoice.id, jumlah, tanggal, catatan || null)
      toast({ type: 'success', title: 'Pembayaran dicatat', message: 'Alokasi otomatis ke job-job dalam invoice.' })
      setJumlahText('')
      setCatatan('')
      await load()
      onChanged()
    } catch (err) {
      toast({ type: 'error', title: 'Gagal mencatat pembayaran', message: (err as Error).message })
    } finally {
      setSaving(false)
    }
  }

  async function reverseAll() {
    const ok = await confirm({
      title: 'Batalkan semua pembayaran?',
      message: `Semua pembayaran invoice ${invoice.nomor ?? ''} akan dibatalkan. Job-job di dalamnya dikembalikan ke "Belum Bayar".`,
      confirmLabel: 'Batalkan',
      danger: true,
    })
    if (!ok) return
    try {
      await reverseInvoicePayments(invoice.id)
      toast({ type: 'success', title: 'Pembayaran dibatalkan' })
      await load()
      onChanged()
    } catch (err) {
      toast({ type: 'error', title: 'Gagal membatalkan', message: (err as Error).message })
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md max-h-[90vh] overflow-y-auto overscroll-contain">
        <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-white">
          <div>
            <h3 className="font-bold text-slate-900 flex items-center gap-2"><Wallet size={18} /> Pembayaran Invoice</h3>
            <p className="text-xs text-slate-500 mt-0.5">{invoice.vendor_nama}{invoice.nomor ? ` · ${invoice.nomor}` : ''}</p>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg"><X size={18} /></button>
        </div>

        <div className="p-4 space-y-4">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="bg-slate-50 rounded-xl p-3">
              <p className="text-xs text-slate-500 mb-1">Total</p>
              <p className="font-bold text-sm text-slate-900">{rupiah(invoice.total)}</p>
            </div>
            <div className="bg-sky-50 rounded-xl p-3">
              <p className="text-xs text-slate-500 mb-1">Sudah Dibayar</p>
              <p className="font-bold text-sm text-sky-700">{rupiah(totalDibayar)}</p>
            </div>
            <div className={`rounded-xl p-3 ${sisa === 0 ? 'bg-emerald-50' : 'bg-amber-50'}`}>
              <p className="text-xs text-slate-500 mb-1">Sisa</p>
              <p className={`font-bold text-sm ${sisa === 0 ? 'text-emerald-700' : 'text-amber-700'}`}>{rupiah(sisa)}</p>
            </div>
          </div>

          <p className="text-xs text-slate-500 bg-slate-50 rounded-xl p-3">
            Satu pembayaran otomatis dibagikan ke job-job dalam invoice: job paling awal dilunasi penuh dulu, kelebihannya lanjut ke job berikutnya.
          </p>

          {sisa > 0 && (
            <form onSubmit={submitPayment} className="space-y-3 bg-slate-50 rounded-xl p-3 pb-4">
              <p className="text-sm font-medium text-slate-700">Catat Pembayaran Baru</p>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Jumlah</label>
                  <input
                    type="text" inputMode="numeric" value={formatRibuan(jumlahText)} autoFocus
                    onChange={(e) => setJumlahText(parseRibuan(e.target.value).toString())}
                    placeholder="0" className="input-base"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Tanggal</label>
                  <input type="date" value={tanggal} onChange={(e) => setTanggal(e.target.value)} className="input-base" />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setJumlahText(String(sisa))} className="text-xs px-2 py-1 rounded-lg bg-white border border-slate-200 hover:bg-slate-100">
                  Lunas sekarang ({rupiah(sisa)})
                </button>
              </div>
              <input type="text" value={catatan} onChange={(e) => setCatatan(e.target.value)} placeholder="Catatan (opsional)" className="input-base" />
              <button type="submit" disabled={saving} className="btn-primary w-full !py-2 text-sm disabled:opacity-60">
                {saving ? 'Menyimpan...' : 'Simpan Pembayaran'}
              </button>
            </form>
          )}

          <div>
            <p className="text-sm font-medium text-slate-700 mb-2">Riwayat Pembayaran</p>
            {loading ? (
              <p className="text-sm text-slate-400 text-center py-4">Memuat...</p>
            ) : payments.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-4">Belum ada pembayaran tercatat.</p>
            ) : (
              <div className="space-y-2">
                {payments.map((p) => (
                  <div key={p.id} className="flex items-center justify-between bg-white border border-slate-100 rounded-xl p-3">
                    <div>
                      <p className="font-semibold text-sm text-slate-900">{rupiah(p.jumlah)}</p>
                      <p className="text-xs text-slate-500">{formatDate(p.tanggal)}{p.catatan ? ` · ${p.catatan}` : ''}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {totalDibayar > 0 && (
            <button onClick={reverseAll} className="text-xs text-red-500 hover:underline w-full text-center pt-2 flex items-center justify-center gap-1">
              <RotateCcw size={13} /> Batalkan semua pembayaran & kembalikan ke "Belum Bayar"
            </button>
          )}
        </div>
      </div>
    </div>
  )
}