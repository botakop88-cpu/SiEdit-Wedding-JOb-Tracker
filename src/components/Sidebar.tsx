import { NavLink } from 'react-router-dom'
import { LogOut, Camera } from 'lucide-react'
import { NAV_ITEMS } from '../lib/nav'
import { useAuth } from '../lib/AuthContext'
import { useUrgentJobs } from '../lib/useUrgentJobs'

export default function Sidebar() {
  const { user, signOut } = useAuth()
  const { count } = useUrgentJobs()

  return (
    <aside className="hidden md:flex flex-col w-64 bg-[#0f172a] text-white min-h-screen shrink-0 sticky top-0 h-screen border-r border-slate-800">
      <div className="flex items-center gap-3 px-5 py-6">
        <Camera className="w-8 h-8 text-rose-400 shrink-0" />
        <div>
          <h1 className="font-extrabold text-lg text-white leading-tight">SiEdit</h1>
          <p className="text-xs text-slate-400">Wedding Job Tracker</p>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                isActive
                  ? 'bg-gradient-to-r from-rose-600 to-rose-500 text-white shadow-lg shadow-rose-600/30'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`
            }
          >
            <Icon className="w-5 h-5" />
            <span className="flex-1">{label}</span>
            {to === '/jobs' && count > 0 && (
              <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
                {count > 99 ? '99+' : count}
              </span>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="px-4 py-4 border-t border-slate-800">
        <div className="flex items-center gap-2.5 mb-3">
          <div className="flex items-center justify-center w-9 h-9 rounded-full bg-gradient-to-br from-rose-500/30 to-orange-400/30 border border-rose-400/30 text-sm font-bold text-rose-300 shrink-0 uppercase">
            {(user?.user_metadata?.full_name ?? user?.user_metadata?.name ?? user?.email?.[0] ?? '?')[0]}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white truncate">
              {user?.user_metadata?.full_name ?? user?.user_metadata?.name ?? 'Pengguna'}
            </p>
            <p className="text-xs text-slate-400 truncate">{user?.email}</p>
          </div>
        </div>
        <button
          onClick={() => signOut()}
          className="flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors w-full px-1 py-1"
        >
          <LogOut className="w-4 h-4" />
          Keluar
        </button>
      </div>
    </aside>
  )
}
