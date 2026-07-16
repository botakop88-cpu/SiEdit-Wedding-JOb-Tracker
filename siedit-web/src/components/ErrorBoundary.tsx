import { Component, type ReactNode, type ErrorInfo } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('ErrorBoundary caught:', error, info.componentStack)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 max-w-md w-full text-center space-y-4">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-red-100 mx-auto">
              <AlertTriangle className="w-7 h-7 text-red-600" />
            </div>
            <h2 className="text-lg font-bold text-slate-800">Terjadi Kesalahan</h2>
            <p className="text-sm text-slate-500">
              Maaf, terjadi kesalahan yang tidak terduga. Silakan refresh halaman.
            </p>
            {this.state.error && (
              <details className="text-xs text-left text-slate-400 bg-slate-50 rounded-lg p-3 max-h-32 overflow-auto">
                <summary className="cursor-pointer font-medium">Detail teknis</summary>
                {this.state.error.message}
              </details>
            )}
            <button
              onClick={() => window.location.reload()}
              className="inline-flex items-center gap-1.5 bg-rose-600 hover:bg-rose-700 text-white text-sm font-medium px-5 py-2.5 rounded-lg transition-colors"
            >
              <RefreshCw className="w-4 h-4" /> Refresh Halaman
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}