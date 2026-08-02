import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react'
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react'

type ToastType = 'success' | 'error' | 'info'
type ToastAction = { label: string; onClick: () => void }

interface Toast {
  id: number
  type: ToastType
  title: string
  message?: string
  action?: ToastAction
}

interface ToastContextValue {
  toast: (opts: {
    type?: ToastType
    title: string
    message?: string
    action?: ToastAction
  }) => void
  confirm: (opts: {
    title: string
    message?: string
    confirmLabel?: string
    danger?: boolean
  }) => Promise<boolean>
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined)

const ICONS: Record<ToastType, ReactNode> = {
  success: <CheckCircle2 className="w-5 h-5 text-emerald-500" />,
  error: <AlertCircle className="w-5 h-5 text-rose-500" />,
  info: <Info className="w-5 h-5 text-sky-500" />,
}

const STYLES: Record<ToastType, string> = {
  success: 'border-l-emerald-500',
  error: 'border-l-rose-500',
  info: 'border-l-sky-500',
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const [dialog, setDialog] = useState<{
    id: number
    title: string
    message?: string
    confirmLabel: string
    danger: boolean
    resolve: (ok: boolean) => void
  } | null>(null)
  const idRef = useRef(0)

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const toast = useCallback((opts: { type?: ToastType; title: string; message?: string; action?: ToastAction }) => {
    const id = ++idRef.current
    const t: Toast = {
      id,
      type: opts.type ?? 'info',
      title: opts.title,
      message: opts.message,
      action: opts.action,
    }
    setToasts((prev) => [...prev.slice(-3), t])
    window.setTimeout(() => dismiss(id), 4000)
  }, [dismiss])

  const confirm = useCallback((opts: {
    title: string
    message?: string
    confirmLabel?: string
    danger?: boolean
  }) => {
    return new Promise<boolean>((resolve) => {
      const id = ++idRef.current
      setDialog({ id, title: opts.title, message: opts.message, confirmLabel: opts.confirmLabel ?? 'Hapus', danger: opts.danger ?? false, resolve })
    })
  }, [])

  const value = useMemo(() => ({ toast, confirm }), [toast, confirm])

  return (
    <ToastContext.Provider value={value}>
      {children}

      {/* Toast stack */}
      <div className="fixed bottom-20 md:bottom-6 right-4 z-[100] flex flex-col gap-2 w-[calc(100%-2rem)] max-w-sm">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`card border-l-4 ${STYLES[t.type]} p-4 shadow-lg animate-[slideIn_.25s_ease]`}
            style={{ animation: 'slideIn 0.25s ease' }}
          >
            <div className="flex items-start gap-3">
              <div className="shrink-0 mt-0.5">{ICONS[t.type]}</div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-900">{t.title}</p>
                {t.message && <p className="text-xs text-slate-600 mt-0.5">{t.message}</p>}
                {t.action && (
                  <button
                    onClick={() => { t.action!.onClick(); dismiss(t.id) }}
                    className="text-xs font-semibold text-rose-600 hover:text-rose-700 mt-1.5"
                  >
                    {t.action.label}
                  </button>
                )}
              </div>
              <button onClick={() => dismiss(t.id)} className="shrink-0 p-0.5 text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Confirm dialog */}
      {dialog && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="card p-6 w-full max-w-sm">
            <div className="flex items-start gap-3">
              <div className={`shrink-0 rounded-full p-2 ${dialog.danger ? 'bg-rose-100' : 'bg-amber-100'}`}>
                <AlertCircle className={`w-5 h-5 ${dialog.danger ? 'text-rose-600' : 'text-amber-600'}`} />
              </div>
              <div className="min-w-0">
                <h3 className="text-sm font-bold text-slate-900">{dialog.title}</h3>
                {dialog.message && <p className="text-xs text-slate-600 mt-1">{dialog.message}</p>}
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button
                onClick={() => { dialog.resolve(false); setDialog(null) }}
                className="flex-1 btn-secondary justify-center"
              >
                Batal
              </button>
              <button
                onClick={() => { dialog.resolve(true); setDialog(null) }}
                className={`flex-1 inline-flex items-center justify-center text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors ${
                  dialog.danger ? 'bg-rose-600 hover:bg-rose-700' : 'bg-amber-500 hover:bg-amber-600'
                }`}
              >
                {dialog.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}
