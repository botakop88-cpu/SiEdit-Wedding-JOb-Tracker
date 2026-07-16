import { LayoutDashboard, Briefcase, Users, FileText, Settings } from 'lucide-react'

export const NAV_ITEMS = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/jobs', label: 'Job', icon: Briefcase },
  { to: '/vendors', label: 'Vendor', icon: Users },
  { to: '/invoices', label: 'Invoice', icon: FileText },
  { to: '/settings', label: 'Pengaturan', icon: Settings },
] as const