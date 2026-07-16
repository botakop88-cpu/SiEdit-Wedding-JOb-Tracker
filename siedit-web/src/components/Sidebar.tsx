import { NavLink } from 'react-router-dom'
import { LogOut, Camera } from 'lucide-react'
import { NAV_ITEMS } from '../lib/nav'
import { useAuth } from '../lib/AuthContext'

export default function Sidebar() {
  const { user, signOut } = useAuth()

  return (
    <aside className="hidden md:flex flex-col w-60 bg-slate-900 text-white min-h-screen shrink-0">
      <div className="flex items-center gap-2 px-5 py-6 border-b border-slate-700">
        <Camera className="w-7 h-7 text-rose-400" />
        <div>
          <h1 className="font-bold text-lg leading-tight">SiEdit</h1>
          <p className="text-xs text-slate-400">Wedding Job Tracker</p>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-rose-600 text-white'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`
            }
          >
            <Icon className="w-5 h-5" />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="px-4 py-4 border-t border-slate-700">
        <p className="text-xs text-slate-400 truncate mb-2">{user?.email}</p>
        <button
          onClick={() => signOut()}
          className="flex items-center gap-2 text-sm text-slate-300 hover:text-white transition-colors w-full"
        >
          <LogOut className="w-4 h-4" />
          Keluar
        </button>
      </div>
    </aside>
  )
}