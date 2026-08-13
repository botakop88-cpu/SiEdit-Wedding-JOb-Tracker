import type { StatusEdit, StatusBayar, StatusCetak } from './types'

export type StatusType = 'edit' | 'bayar' | 'cetak'

export type StatusValue = StatusEdit | StatusBayar | StatusCetak

export function getStatusOptions(type: StatusType): StatusValue[] {
  if (type === 'edit') return ['Masuk', 'Sedang Edit', 'Revisi', 'Selesai']
  if (type === 'bayar') return ['Belum Bayar', 'Lunas']
  return ['Belum Cetak', 'Sudah Dikirim', 'Sudah Cetak']
}

export function getStatusBadgeClass(type: StatusType, value: string): string {
  if (type === 'edit') {
    if (value === 'Masuk') return 'bg-blue-100 text-blue-700'
    if (value === 'Sedang Edit') return 'bg-orange-100 text-orange-700'
    if (value === 'Revisi') return 'bg-purple-100 text-purple-700'
    return 'bg-emerald-100 text-emerald-700'
  }
  if (type === 'bayar') {
    return value === 'Lunas' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
  }
  return value === 'Sudah Cetak' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'
}

export function isValidStatus(type: StatusType, value: unknown): boolean {
  return getStatusOptions(type).includes(value as StatusValue)
}
