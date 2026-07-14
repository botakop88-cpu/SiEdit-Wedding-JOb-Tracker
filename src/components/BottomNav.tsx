import { NavLink } from 'react-router-dom'
import { LogOut } from 'lucide-react'
import { NAV_ITEMS } from '../lib/nav'
import { useAuth } from '../lib/AuthContext'

export default function BottomNav() {
  const { signOut } = useAuth()

  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-50 bg-white border-t border-slate-200 flex justify-around items-center py-1.5 pb-[max(0.375rem,env(safe-area-inset-bottom))]">
      {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          className={({ isActive }) =>
            `flex flex-col items-center gap-0.5 px-2 py-1 text-[10px] font-medium transition-colors ${
              isActive ? 'text-rose-600' : 'text-slate-400'
            }`
          }
        >
          <Icon className="w-5 h-5" />
          {label}
        </NavLink>
      ))}
      <button
        onClick={() => signOut()}
        className="flex flex-col items-center gap-0.5 px-2 py-1 text-[10px] font-medium text-slate-400 hover:text-rose-600 transition-colors"
      >
        <LogOut className="w-4 h-4" />
        Keluar
      </button>
    </nav>
  )
}