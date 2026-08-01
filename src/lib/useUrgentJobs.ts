import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import type { Job } from './types'

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T00:00:00')
  d.setDate(d.getDate() + days)
  return d.getFullYear() + '-' +
    String(d.getMonth() + 1).padStart(2, '0') + '-' +
    String(d.getDate()).padStart(2, '0')
}

export function urgentDeadlineDate(): string {
  const now = new Date()
  const today = now.getFullYear() + '-' +
    String(now.getMonth() + 1).padStart(2, '0') + '-' +
    String(now.getDate()).padStart(2, '0')
  return addDays(today, 3)
}

export function useUrgentJobs() {
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      const max = urgentDeadlineDate()
      const { data, error } = await supabase
        .from('job')
        .select('*, vendor:vendor_id(nama, whatsapp)')
        .is('deleted_at', null)
        .not('deadline', 'is', null)
        .lte('deadline', max)
        .not('status_edit', 'in', '("Selesai")')
        .neq('status_bayar', 'Lunas')
        .order('deadline')
      if (!cancelled) {
        if (!error && data) setJobs(data as Job[])
        setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  return { jobs, loading, count: jobs.length }
}

// ─── Deadline helpers ───────────────────────────────────────────
export type UrgentGroup = 'overdue' | 'hariIni' | 'besok' | 'h2' | 'h3'

export function deadlineGroup(days: number): UrgentGroup {
  if (days < 0) return 'overdue'
  if (days === 0) return 'hariIni'
  if (days === 1) return 'besok'
  if (days === 2) return 'h2'
  return 'h3'
}

export function daysLabel(days: number): string {
  if (days < 0) return `Terlambat ${Math.abs(days)} hari`
  if (days === 0) return 'Deadline hari ini'
  if (days === 1) return 'Deadline besok'
  return `Deadline H-${days}`
}

export function urgentGroupMeta(group: UrgentGroup): { label: string; badge: string } {
  switch (group) {
    case 'overdue':
      return { label: 'Terlambat', badge: 'bg-red-100 text-red-700' }
    case 'hariIni':
      return { label: 'Hari ini', badge: 'bg-red-100 text-red-700' }
    case 'besok':
      return { label: 'Besok', badge: 'bg-orange-100 text-orange-700' }
    case 'h2':
      return { label: 'H-2', badge: 'bg-amber-100 text-amber-700' }
    case 'h3':
      return { label: 'H-3', badge: 'bg-yellow-100 text-yellow-700' }
  }
}
