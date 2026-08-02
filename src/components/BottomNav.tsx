import { NavLink } from 'react-router-dom'
import { NAV_ITEMS } from '../lib/nav'
import { useUrgentJobs } from '../lib/useUrgentJobs'

export default function BottomNav() {
  const { count } = useUrgentJobs()

  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-50 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
      <div className="bg-white/95 backdrop-blur-lg border border-slate-200 rounded-2xl shadow-xl flex justify-around items-center px-1 py-1.5">
        {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `relative flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-xl text-[10px] font-semibold transition-colors ${
                isActive ? 'text-rose-500 bg-rose-50' : 'text-slate-500'
              }`
            }
          >
            <Icon className="w-5 h-5" />
            {label}
            {to === '/jobs' && count > 0 && (
              <span className="absolute -top-0.5 right-1 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">
                {count > 9 ? '9+' : count}
              </span>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
