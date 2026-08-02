import { useEffect, useState } from 'react'
import { User, Bell, Trash2, Info, Clock, X, Send, CheckCircle2, Lock, ClipboardList, Users, ReceiptText } from 'lucide-react'
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
      }
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
      return supabase
        .from('user_settings')
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq('id', settings.id)
    }
    return supabase
      .from('user_settings')
      .insert({ user_id: user.id, ...patch })
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

              {/* Pilih Jenis Notifikasi */}
              <div>
                <h3 className="font-semibold text-slate-900 mb-3">Pilih Jenis Notifikasi</h3>
                <div className="space-y-3">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input type="checkbox" defaultChecked className="w-4 h-4 rounded border-slate-300 text-rose-500 focus:ring-rose-500" />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-slate-900">Deadline Hari Ini</span>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">Disarankan</span>
                      </div>
                      <p className="text-xs text-slate-500">Kirim notifikasi untuk job yang deadline hari ini.</p>
                    </div>
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input type="checkbox" defaultChecked className="w-4 h-4 rounded border-slate-300 text-rose-500 focus:ring-rose-500" />
                    <div className="flex-1">
                      <span className="text-sm font-medium text-slate-900">Deadline Besok</span>
                      <p className="text-xs text-slate-500">Kirim notifikasi ketika ada job deadline besok.</p>
                    </div>
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input type="checkbox" defaultChecked className="w-4 h-4 rounded border-slate-300 text-rose-500 focus:ring-rose-500" />
                    <div className="flex-1">
                      <span className="text-sm font-medium text-slate-900">Job Baru</span>
                      <p className="text-xs text-slate-500">Kirim notifikasi ketika ada job baru dibuat.</p>
                    </div>
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input type="checkbox" defaultChecked className="w-4 h-4 rounded border-slate-300 text-rose-500 focus:ring-rose-500" />
                    <div className="flex-1">
                      <span className="text-sm font-medium text-slate-900">Job Revisi</span>
                      <p className="text-xs text-slate-500">Kirim notifikasi ketika ada job yang masuk revisi.</p>
                    </div>
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input type="checkbox" defaultChecked className="w-4 h-4 rounded border-slate-300 text-rose-500 focus:ring-rose-500" />
                    <div className="flex-1">
                      <span className="text-sm font-medium text-slate-900">Vendor Belum Bayar</span>
                      <p className="text-xs text-slate-500">Kirim notifikasi untuk vendor yang masih memiliki tagihan belum lunas.</p>
                    </div>
                  </label>
                </div>
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
