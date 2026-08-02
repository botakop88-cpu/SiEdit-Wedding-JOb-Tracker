import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import Sidebar from './Sidebar'
import BottomNav from './BottomNav'
import NotificationBell from './NotificationBell'

const PAGE_META: Record<string, { title: string; description: string }> = {
  '/dashboard': { title: 'Dashboard', description: 'Ringkasan performa bisnis Anda.' },
  '/jobs': { title: 'Daftar Job', description: 'Kelola semua pekerjaan editing dari setiap vendor.' },
  '/vendors': { title: 'Vendor', description: 'Kelola dan pantau semua vendor Anda.' },
  '/invoices': { title: 'Invoice', description: 'Buat dan kelola invoice per vendor.' },
  '/reports': { title: 'Laporan', description: 'Penghasilan & performa bisnis Anda.' },
  '/settings': { title: 'Pengaturan', description: 'Kelola informasi akun, notifikasi, dan data Anda.' },
  '/notifications': { title: 'Notifikasi', description: 'Job dengan deadline mendekat atau terlambat.' },
}

export default function AppLayout() {
  const { user, loading } = useAuth()
  const location = useLocation()
  const meta = PAGE_META[location.pathname] ?? { title: 'SiEdit', description: '' }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-10 w-10 border-4 border-rose-500 border-t-transparent" />
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />

      <main className="flex-1 min-w-0">
        {/* Mobile top header */}
        <header className="md:hidden sticky top-0 z-40 bg-white/95 backdrop-blur-lg border-b border-slate-200 px-4 py-3 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-2.5">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-rose-500 to-orange-400 shadow-md shadow-rose-500/30">
              <span className="text-white font-extrabold text-sm">S</span>
            </div>
            <div>
              <p className="font-extrabold text-slate-900 leading-none">{meta.title}</p>
              <p className="text-[10px] text-slate-500 mt-0.5">{meta.description}</p>
            </div>
          </div>
          <NotificationBell />
        </header>

        {/* Desktop top bar */}
        <div className="hidden md:block sticky top-0 z-30 bg-white/80 backdrop-blur border-b border-slate-200">
          <div className="max-w-6xl mx-auto px-8 py-4 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-extrabold text-slate-900">{meta.title}</h2>
              <p className="text-sm text-slate-500 mt-0.5">{meta.description}</p>
            </div>
            <NotificationBell />
          </div>
        </div>

        <div className="pb-24 md:pb-0">
          <Outlet />
        </div>
      </main>

      <BottomNav />
    </div>
  )
}
