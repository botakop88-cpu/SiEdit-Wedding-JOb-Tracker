import { useEffect, useState } from 'react'
import { User, Bell, Trash2, Info, Clock, X, Send, CheckCircle2, Lock, ClipboardList, Users, ReceiptText, Image as ImageIcon, Download, DatabaseBackup, RefreshCw } from 'lucide-react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../lib/AuthContext'
import { useToast } from '../lib/ToastContext'
import type { UserSettings } from '../lib/types'
import RecycleBinModal from '../components/RecycleBinModal'

const TELEGRAM_BOT_USERNAME = 'SiEdit_NotifBot'
const CONNECT_MINUTES = 15

function genConnectCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  return Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

export default function Settings() {
  const { user } = useAuth()
  const { toast, confirm } = useToast()
  const [settings, setSettings] = useState<UserSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [nama, setNama] = useState<string>(user?.user_metadata?.full_name ?? user?.user_metadata?.name ?? '')
  const [jam, setJam] = useState('07:00')
  const [notifModal, setNotifModal] = useState(false)
  const [connectModal, setConnectModal] = useState(false)
  const [connectCode, setConnectCode] = useState('')
  const [connectExpires, setConnectExpires] = useState('')
  const [recycleCount, setRecycleCount] = useState({ jobs: 0, vendors: 0, invoices: 0 })
  const [recycleOpen, setRecycleOpen] = useState(false)
  const [namaStudio, setNamaStudio] = useState('')
  const [invoiceFooter, setInvoiceFooter] = useState('')
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [savingInvoiceCustom, setSavingInvoiceCustom] = useState(false)
  const [backupList, setBackupList] = useState<{ name: string; size: number }[]>([])
  const [loadingBackups, setLoadingBackups] = useState(false)
  const [backingUpNow, setBackingUpNow] = useState(false)

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    if (user?.user_metadata?.full_name ?? user?.user_metadata?.name) {
      setNama(user.user_metadata.full_name ?? user.user_metadata.name)
    }
  }, [user?.id, user?.user_metadata?.full_name, user?.user_metadata?.name])

  async function loadData() {
    setLoading(true)
    if (user) {
      const { data } = await supabase
        .from('user_settings')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle()
      if (data) {
        const s = data as UserSettings
        setSettings(s)
        setJam(s.notif_jam?.slice(0, 5) ?? '07:00')
        setNamaStudio(s.nama_studio ?? '')
        setInvoiceFooter(s.invoice_footer ?? '')
      }
      loadBackups()
    }

    const [jRes, vRes, iRes] = await Promise.all([
      supabase.from('job').select('*', { count: 'exact', head: true }).not('deleted_at', 'is', null),
      supabase.from('vendor').select('*', { count: 'exact', head: true }).not('deleted_at', 'is', null),
      supabase.from('invoice').select('*', { count: 'exact', head: true }).not('deleted_at', 'is', null),
    ])
    setRecycleCount({
      jobs: jRes.count ?? 0,
      vendors: vRes.count ?? 0,
      invoices: iRes.count ?? 0,
    })
    setLoading(false)
  }

  async function saveSettings(patch: Partial<UserSettings>) {
    if (!user) return { error: { message: 'Tidak terautentikasi' } as { message: string } }
    if (settings?.id) {
      const res = await supabase
        .from('user_settings')
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq('id', settings.id)
      return res
    }
    // Belum ada baris user_settings. Insert, lalu simpan id hasil ke state supaya
    // pemanggilan berikutnya memakai update (bukan insert lagi) — mencegah baris ganda
    // yang membuat .maybeSingle() gagal sehingga pengaturan tidak pernah termuat.
    const res = await supabase
      .from('user_settings')
      .insert({ user_id: user.id, ...patch })
      .select('id')
      .single()
    if (!res.error && res.data) {
      setSettings((s) => ({ ...(s as UserSettings), id: (res.data as { id: string }).id }))
    }
    return res
  }

  async function handleSaveProfile() {
    setSaving(true)
    const { error } = await supabase.auth.updateUser({ data: { full_name: nama.trim() || 'Pengguna' } })
    setSaving(false)
    if (error) return toast({ type: 'error', title: 'Gagal menyimpan profil', message: error.message })
    toast({ type: 'success', title: 'Profil diperbarui' })
  }

  async function handleConnectTelegram() {
    if (!user) return
    setSaving(true)
    const code = genConnectCode()
    const expires = new Date(Date.now() + CONNECT_MINUTES * 60 * 1000).toISOString()
    const res = await saveSettings({ telegram_connect_code: code, telegram_connect_expires: expires })
    setSaving(false)
    if (res.error) return toast({ type: 'error', title: 'Gagal membuat kode', message: res.error.message })
    setConnectCode(code)
    setConnectExpires(expires)
    setNotifModal(false)
    setConnectModal(true)
  }

  async function handleDisconnectTelegram() {
    const ok = await confirm({
      title: 'Putuskan Telegram?',
      message: 'Notifikasi deadline tidak akan dikirim lagi ke Telegram.',
      confirmLabel: 'Putuskan',
      danger: true,
    })
    if (!ok) return
    const res = await saveSettings({ telegram_chat_id: null, telegram_connect_code: null, telegram_connect_expires: null })
    if (res.error) return toast({ type: 'error', title: 'Gagal memutuskan', message: res.error.message })
    setSettings({ ...settings!, telegram_chat_id: null, telegram_connect_code: null, telegram_connect_expires: null })
    toast({ type: 'success', title: 'Telegram diputuskan' })
  }

  async function handleSaveJam() {
    setSaving(true)
    const res = await saveSettings({ notif_jam: `${jam}:00` })
    setSaving(false)
    if (res.error) return toast({ type: 'error', title: 'Gagal menyimpan', message: res.error.message })
    setSettings({ ...settings!, notif_jam: `${jam}:00` })
    setNotifModal(false)
    toast({ type: 'success', title: 'Jam notifikasi disimpan' })
  }

  async function handleCheckUpdate() {
    toast({ type: 'success', title: 'Sudah versi terbaru', message: 'SiEdit v1.0.0 adalah versi terkini.' })
  }

  /* ─── Kustomisasi Invoice ───────────────────────────────────── */

  function resizeImage(file: File, maxDim: number): Promise<Blob> {
    return new Promise((resolve, reject) => {
      const img = new Image()
      const url = URL.createObjectURL(file)
      img.onload = () => {
        URL.revokeObjectURL(url)
        let { width, height } = img
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height / width) * maxDim)
            width = maxDim
          } else {
            width = Math.round((width / height) * maxDim)
            height = maxDim
          }
        }
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        if (!ctx) return reject(new Error('Canvas tidak didukung browser ini'))
        ctx.drawImage(img, 0, 0, width, height)
        canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Gagal memproses gambar'))), 'image/png')
      }
      img.onerror = () => reject(new Error('File bukan gambar yang valid'))
      img.src = url
    })
  }

  async function handleLogoFile(file: File) {
    if (!user) return
    if (!file.type.startsWith('image/')) {
      return toast({ type: 'error', title: 'File harus berupa gambar' })
    }
    if (file.size > 5 * 1024 * 1024) {
      return toast({ type: 'error', title: 'Ukuran file maksimal 5MB' })
    }
    setUploadingLogo(true)
    try {
      const resized = await resizeImage(file, 400)
      const path = `${user.id}/logo.png`
      const { error: upErr } = await supabase.storage.from('invoice-assets').upload(path, resized, {
        upsert: true,
        contentType: 'image/png',
      })
      if (upErr) throw upErr
      const { data: pub } = supabase.storage.from('invoice-assets').getPublicUrl(path)
      // Cache-bust hanya untuk URL http(s) sungguhan; blob URL (mode demo) sudah unik
      // per file sehingga tidak boleh ditambah query string.
      const urlWithCacheBust = pub.publicUrl.startsWith('blob:') ? pub.publicUrl : `${pub.publicUrl}?t=${Date.now()}`
      const res = await saveSettings({ invoice_logo_url: urlWithCacheBust })
      if (res.error) throw res.error
      setSettings((s) => (s ? { ...s, invoice_logo_url: urlWithCacheBust } : s))
      toast({ type: 'success', title: 'Logo diperbarui' })
    } catch (err) {
      toast({ type: 'error', title: 'Gagal upload logo', message: (err as Error).message })
    } finally {
      setUploadingLogo(false)
    }
  }

  async function handleRemoveLogo() {
    if (!user) return
    const ok = await confirm({ title: 'Hapus logo invoice?', confirmLabel: 'Hapus', danger: true })
    if (!ok) return
    await supabase.storage.from('invoice-assets').remove([`${user.id}/logo.png`])
    const res = await saveSettings({ invoice_logo_url: null })
    if (res.error) return toast({ type: 'error', title: 'Gagal menghapus logo', message: res.error.message })
    setSettings((s) => (s ? { ...s, invoice_logo_url: null } : s))
    toast({ type: 'success', title: 'Logo dihapus' })
  }

  async function handleSaveInvoiceCustom() {
    setSavingInvoiceCustom(true)
    const patch = { nama_studio: namaStudio.trim() || null, invoice_footer: invoiceFooter.trim() || null }
    const res = await saveSettings(patch)
    setSavingInvoiceCustom(false)
    if (res.error) return toast({ type: 'error', title: 'Gagal menyimpan', message: res.error.message })
    setSettings((s) => (s ? { ...s, ...patch } : s))
    toast({ type: 'success', title: 'Kustomisasi invoice disimpan' })
  }

  /* ─── Backup ───────────────────────────────────── */

  async function loadBackups() {
    if (!user) return
    setLoadingBackups(true)
    const { data } = await supabase.storage.from('backups').list(user.id, {
      limit: 30,
      sortBy: { column: 'name', order: 'desc' },
    })
    setBackupList((data ?? []).filter((f) => f.name.endsWith('.json')).map((f) => ({ name: f.name, size: f.metadata?.size ?? 0 })))
    setLoadingBackups(false)
  }

  async function handleBackupNow() {
    setBackingUpNow(true)
    const { error } = await supabase.functions.invoke('backup-now', { method: 'POST' })
    setBackingUpNow(false)
    if (error) return toast({ type: 'error', title: 'Gagal backup', message: error.message })
    toast({ type: 'success', title: 'Backup berhasil dibuat' })
    loadBackups()
  }

  async function handleDownloadBackup(name: string) {
    if (!user) return
    const { data, error } = await supabase.storage.from('backups').createSignedUrl(`${user.id}/${name}`, 60)
    if (error || !data) return toast({ type: 'error', title: 'Gagal membuat link unduhan', message: error?.message })
    window.open(data.signedUrl, '_blank')
  }

  function formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
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
      {/* Profil */}
      <section className="card p-5">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-9 h-9 rounded-full bg-rose-100 flex items-center justify-center shrink-0">
            <User className="w-4 h-4 text-rose-500" />
          </div>
          <div>
            <h2 className="font-bold text-slate-900">Profil</h2>
            <p className="text-xs text-slate-500">Informasi akun dan bisnis Anda.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Nama</label>
            <input
              type="text"
              value={nama}
              onChange={(e) => setNama(e.target.value)}
              placeholder="Nama Anda"
              className="input-base"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Email</label>
            <div className="relative">
              <input
                type="email"
                value={user?.email ?? ''}
                disabled
                className="input-base pr-9 bg-slate-50 text-slate-400 cursor-not-allowed"
              />
              <Lock className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end mt-6 pt-4 border-t border-slate-100">
          <button onClick={handleSaveProfile} disabled={saving} className="btn-primary min-w-[150px] justify-center">
            {saving ? 'Menyimpan…' : 'Edit Profil'}
          </button>
        </div>
      </section>

      {/* Notifikasi */}
      <section className="card p-5">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-9 h-9 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
            <Bell className="w-4 h-4 text-emerald-500" />
          </div>
          <div>
            <h2 className="font-bold text-slate-900">Notifikasi</h2>
            <p className="text-xs text-slate-500">Atur notifikasi & pengingat.</p>
          </div>
        </div>

        <div className="space-y-3 max-w-3xl">
          {/* Telegram */}
          <div className="flex items-center gap-3 p-4 rounded-xl bg-slate-50 border border-slate-100">
            <div className="w-10 h-10 rounded-full bg-sky-100 flex items-center justify-center shrink-0">
              <Send className="w-5 h-5 text-sky-500" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-slate-900">Telegram</p>
              <p className="text-sm text-slate-500 truncate">@{TELEGRAM_BOT_USERNAME}</p>
            </div>
            {settings?.telegram_chat_id ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                Terhubung
              </span>
            ) : (
              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-500 shrink-0">
                Belum Terhubung
              </span>
            )}
          </div>

          {/* Jam Notifikasi */}
          <div className="flex items-center gap-3 p-4 rounded-xl bg-slate-50 border border-slate-100">
            <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
              <Clock className="w-5 h-5 text-emerald-500" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-slate-900">Jam Notifikasi</p>
              <p className="text-xs text-slate-400">Pengingat harian</p>
            </div>
            <input
              type="time"
              value={jam}
              onChange={(e) => setJam(e.target.value)}
              className="input-base max-w-[135px]"
            />
          </div>
        </div>

        <div className="flex items-center justify-between mt-6 pt-4 border-t border-slate-100 gap-3">
          <p className="text-xs text-slate-500">
            Notifikasi deadline dikirim otomatis ke akun Telegram setiap hari.
          </p>
          <button onClick={() => setNotifModal(true)} className="btn-primary min-w-[150px] justify-center shrink-0">
            Ubah Pengaturan
          </button>
        </div>
      </section>

      {/* Kustomisasi Invoice */}
      <section className="card p-5">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-9 h-9 rounded-full bg-violet-100 flex items-center justify-center shrink-0">
            <ReceiptText className="w-4 h-4 text-violet-500" />
          </div>
          <div>
            <h2 className="font-bold text-slate-900">Kustomisasi Invoice</h2>
            <p className="text-xs text-slate-500">Logo, nama studio, dan catatan kaki pada invoice yang dicetak.</p>
          </div>
        </div>

        <div className="space-y-4 max-w-3xl">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Logo</label>
            <div className="flex items-center gap-4">
              <div className="w-20 h-20 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-center overflow-hidden shrink-0">
                {settings?.invoice_logo_url ? (
                  <img src={settings.invoice_logo_url} alt="Logo" className="w-full h-full object-contain" />
                ) : (
                  <ImageIcon className="w-6 h-6 text-slate-300" />
                )}
              </div>
              <div className="flex flex-col gap-2">
                <label className="btn-secondary !py-1.5 cursor-pointer w-fit">
                  {uploadingLogo ? 'Mengunggah...' : 'Unggah Logo'}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    disabled={uploadingLogo}
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) handleLogoFile(file)
                      e.target.value = ''
                    }}
                  />
                </label>
                {settings?.invoice_logo_url && (
                  <button onClick={handleRemoveLogo} className="text-xs text-red-500 hover:underline w-fit">Hapus logo</button>
                )}
                <p className="text-xs text-slate-400">PNG/JPG, otomatis dikecilkan maks. 400px.</p>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Nama Studio</label>
            <input
              type="text"
              value={namaStudio}
              onChange={(e) => setNamaStudio(e.target.value)}
              placeholder="mis. SiEdit Studio"
              className="input-base max-w-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Catatan Kaki Invoice</label>
            <textarea
              value={invoiceFooter}
              onChange={(e) => setInvoiceFooter(e.target.value)}
              placeholder="mis. Terima kasih atas kerja samanya. Pembayaran transfer ke BCA 1234567890 a.n. ... (gunakan **teks** untuk cetak tebal)"
              rows={3}
              className="input-base"
            />
          </div>
        </div>

        <div className="flex items-center justify-end mt-6 pt-4 border-t border-slate-100">
          <button onClick={handleSaveInvoiceCustom} disabled={savingInvoiceCustom} className="btn-primary min-w-[150px] justify-center">
            {savingInvoiceCustom ? 'Menyimpan…' : 'Simpan'}
          </button>
        </div>
      </section>

      {/* Backup Data */}
      <section className="card p-5">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-9 h-9 rounded-full bg-sky-100 flex items-center justify-center shrink-0">
            <DatabaseBackup className="w-4 h-4 text-sky-500" />
          </div>
          <div>
            <h2 className="font-bold text-slate-900">Backup Data</h2>
            <p className="text-xs text-slate-500">Dibuat otomatis setiap hari, disimpan 14 hari terakhir.</p>
          </div>
        </div>

        <div className="max-w-3xl">
          {loadingBackups ? (
            <p className="text-sm text-slate-400 text-center py-6">Memuat...</p>
          ) : backupList.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-6">Belum ada backup. Backup otomatis pertama akan muncul di sini setelah dijadwalkan berjalan.</p>
          ) : (
            <div className="space-y-2">
              {backupList.map((f) => (
                <div key={f.name} className="flex items-center justify-between px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-100">
                  <div>
                    <p className="text-sm font-medium text-slate-900">{f.name.replace('.json', '')}</p>
                    <p className="text-xs text-slate-400">{formatSize(f.size)}</p>
                  </div>
                  <button onClick={() => handleDownloadBackup(f.name)} className="p-2 hover:bg-slate-100 rounded-lg text-slate-500" title="Download">
                    <Download size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between mt-6 pt-4 border-t border-slate-100 gap-3">
          <p className="text-xs text-slate-500">Bisa juga backup manual kapan saja, di luar jadwal otomatis.</p>
          <button onClick={handleBackupNow} disabled={backingUpNow} className="btn-secondary min-w-[170px] justify-center shrink-0 flex items-center gap-2">
            <RefreshCw size={14} className={backingUpNow ? 'animate-spin' : ''} />
            {backingUpNow ? 'Membackup...' : 'Backup Sekarang'}
          </button>
        </div>
      </section>

      {/* Recycle Bin */}
      <section className="card p-5">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-9 h-9 rounded-full bg-orange-100 flex items-center justify-center shrink-0">
            <Trash2 className="w-4 h-4 text-orange-500" />
          </div>
          <div>
            <h2 className="font-bold text-slate-900">Recycle Bin</h2>
            <p className="text-xs text-slate-500">Data yang dihapus akan tersimpan sementara selama 30 hari.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-3xl">
          <div className="flex items-center gap-3 p-4 rounded-xl bg-slate-50 border border-slate-100">
            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
              <ClipboardList className="w-5 h-5 text-blue-500" />
            </div>
            <div>
              <p className="text-xl font-bold text-slate-900">{recycleCount.jobs}</p>
              <p className="text-sm text-slate-500">Job</p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-4 rounded-xl bg-slate-50 border border-slate-100">
            <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
              <Users className="w-5 h-5 text-emerald-500" />
            </div>
            <div>
              <p className="text-xl font-bold text-slate-900">{recycleCount.vendors}</p>
              <p className="text-sm text-slate-500">Vendor</p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-4 rounded-xl bg-slate-50 border border-slate-100">
            <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
              <ReceiptText className="w-5 h-5 text-amber-500" />
            </div>
            <div>
              <p className="text-xl font-bold text-slate-900">{recycleCount.invoices}</p>
              <p className="text-sm text-slate-500">Invoice</p>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end mt-6 pt-4 border-t border-slate-100">
          <button
            onClick={() => setRecycleOpen(true)}
            className="btn-secondary min-w-[150px] justify-center"
          >
            <Trash2 className="w-4 h-4" />
            Buka Recycle Bin
          </button>
        </div>
      </section>

      {/* Tentang Aplikasi */}
      <section className="card p-5">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-9 h-9 rounded-full bg-purple-100 flex items-center justify-center shrink-0">
            <Info className="w-4 h-4 text-purple-500" />
          </div>
          <div>
            <h2 className="font-bold text-slate-900">Tentang Aplikasi</h2>
            <p className="text-xs text-slate-500">Informasi versi dan update aplikasi.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-3xl">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Versi Aplikasi</label>
            <p className="text-base font-bold text-slate-900">1.0.0</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Database</label>
            <p className="text-base font-bold text-slate-900">Supabase (PostgreSQL)</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Update Terakhir</label>
            <p className="text-base font-bold text-slate-900">2 Agustus 2026</p>
          </div>
        </div>

        <div className="flex items-center justify-end mt-6 pt-4 border-t border-slate-100">
          <button onClick={handleCheckUpdate} className="btn-secondary min-w-[150px] justify-center">
            Cek Update
          </button>
        </div>
      </section>

      {/* Footer */}
      <div className="text-center text-sm text-slate-400 py-4">
        © 2026 SiEdit. Semua hak dilindungi.
      </div>

      {/* Modal Pengaturan Notifikasi */}
      {notifModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="card p-5 w-full max-w-lg">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center">
                  <Bell className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900">Pengaturan Notifikasi</h2>
                  <p className="text-sm text-slate-500">Atur notifikasi sesuai kebutuhan Anda</p>
                </div>
              </div>
              <button onClick={() => setNotifModal(false)} className="p-1 hover:bg-slate-100 rounded">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            <div className="space-y-6">
              {/* Notifikasi Telegram */}
              <div>
                <h3 className="font-semibold text-slate-900 mb-3">Notifikasi Telegram</h3>
                <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <Send className="w-5 h-5 text-sky-500" />
                    <div>
                      <p className="text-sm font-medium text-slate-900">Akun Bot</p>
                      <p className="text-sm text-slate-600">@{TELEGRAM_BOT_USERNAME}</p>
                    </div>
                  </div>
                  {settings?.telegram_chat_id ? (
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-emerald-600">● Terhubung</span>
                      <button onClick={handleDisconnectTelegram} className="text-sm text-rose-600 hover:text-rose-700 font-medium">
                        Putuskan
                      </button>
                    </div>
                  ) : (
                    <button onClick={handleConnectTelegram} className="text-sm text-sky-600 hover:text-sky-700 font-medium">
                      Hubungkan
                    </button>
                  )}
                </div>
              </div>

              {/* Jam Notifikasi */}
              <div>
                <h3 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  Jam Notifikasi
                </h3>
                <p className="text-sm text-slate-500 mb-2">Notifikasi akan dikirim setiap hari pada jam yang dipilih</p>
                <input
                  type="time"
                  value={jam}
                  onChange={(e) => setJam(e.target.value)}
                  className="input-base"
                />
              </div>
            </div>

            <div className="flex items-center gap-3 mt-8">
              <button onClick={() => { setJam('07:00'); toast({ type: 'info', title: 'Jam direset ke 07:00' }) }} className="btn-secondary px-6">
                Reset
              </button>
              <div className="flex-1" />
              <button onClick={() => setNotifModal(false)} className="btn-secondary px-6">
                Batal
              </button>
              <button onClick={handleSaveJam} disabled={saving} className="btn-primary px-6">
                {saving ? 'Menyimpan…' : 'Simpan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Connect Telegram */}
      {connectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="card p-6 w-full max-w-lg">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-sky-100 flex items-center justify-center">
                  <Send className="w-5 h-5 text-sky-600" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900">Hubungkan Telegram</h2>
                  <p className="text-sm text-slate-500">Ikuti 3 langkah berikut</p>
                </div>
              </div>
              <button onClick={() => setConnectModal(false)} className="p-1 hover:bg-slate-100 rounded">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            <ol className="space-y-3 text-sm text-slate-600">
              <li className="flex gap-3">
                <span className="w-6 h-6 shrink-0 rounded-full bg-sky-100 text-sky-600 flex items-center justify-center text-xs font-bold">1</span>
                Buka Telegram dan cari bot <span className="font-semibold text-slate-900">@{TELEGRAM_BOT_USERNAME}</span>
              </li>
              <li className="flex gap-3">
                <span className="w-6 h-6 shrink-0 rounded-full bg-sky-100 text-sky-600 flex items-center justify-center text-xs font-bold">2</span>
                Tekan <span className="font-semibold text-slate-900">Mulai / Start</span> pada bot
              </li>
              <li className="flex gap-3">
                <span className="w-6 h-6 shrink-0 rounded-full bg-sky-100 text-sky-600 flex items-center justify-center text-xs font-bold">3</span>
                Kirim kode berikut ke bot:
              </li>
            </ol>

            <div className="mt-4 p-4 bg-slate-50 rounded-xl text-center">
              <p className="text-3xl font-extrabold tracking-[0.35em] text-slate-900 select-all">{connectCode}</p>
              <p className="text-xs text-slate-500 mt-2">
                Berlaku hingga {new Date(connectExpires).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB
              </p>
            </div>

            <div className="flex items-center justify-between mt-6">
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-600">
                <CheckCircle2 className="w-4 h-4" /> Bot aktif setiap saat
              </span>
              <button onClick={() => setConnectModal(false)} className="btn-primary px-6">
                Selesai
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Recycle Bin */}
      <RecycleBinModal
        open={recycleOpen}
        onClose={() => {
          setRecycleOpen(false)
          loadData()
        }}
      />
    </div>
  )
}
