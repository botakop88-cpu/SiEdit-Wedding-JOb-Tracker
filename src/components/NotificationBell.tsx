import { useNavigate } from 'react-router-dom'
import { Bell } from 'lucide-react'
import { useUrgentJobs } from '../lib/useUrgentJobs'

export default function NotificationBell() {
  const navigate = useNavigate()
  const { count, loading } = useUrgentJobs()

  return (
    <button
      onClick={() => navigate('/notifications')}
      aria-label="Notifikasi"
      className="fixed top-4 right-4 z-40 flex items-center justify-center w-10 h-10 rounded-full bg-white border border-slate-200 shadow-md hover:shadow-lg transition-shadow"
    >
      <Bell className="w-5 h-5 text-slate-600" />
      {!loading && count > 0 && (
        <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
          {count > 99 ? '99+' : count}
        </span>
      )}
    </button>
  )
}
