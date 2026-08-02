import { useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { Camera, Eye, EyeOff } from 'lucide-react'
import { useAuth } from '../lib/AuthContext'

export default function ResetPassword() {
  const { user, loading, updatePassword } = useAuth()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  if (loading) return null
  if (user && success) return <Navigate to="/dashboard" replace />

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    if (password !== confirm) {
      setError('Password dan konfirmasi tidak cocok.')
      return
    }
    if (password.length < 8) {
      setError('Password minimal 8 karakter.')
      return
    }
    setSubmitting(true)
    const { error: err } = await updatePassword(password)
    if (err) setError(err.message)
    else {
      setSuccess(true)
      // Refresh session state
      window.location.reload()
    }
    setSubmitting(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-rose-500 to-orange-400 shadow-xl shadow-rose-500/30 mb-4">
            <Camera className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-extrabold text-white">SiEdit</h1>
          <p className="text-slate-400 mt-1">Wedding Job Tracker</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white/90 backdrop-blur rounded-2xl border border-slate-300 shadow-2xl shadow-black/50 p-8 space-y-5">
          <h2 className="text-xl font-bold text-slate-900">Atur Password Baru</h2>

          {error && (
            <div className="bg-red-500/10 text-red-300 border border-red-500/25 text-sm rounded-xl px-4 py-3">{error}</div>
          )}
          {success && (
            <div className="bg-emerald-500/10 text-emerald-300 border border-emerald-500/25 text-sm rounded-xl px-4 py-3">
              Password berhasil diubah! Mengarahkan ke dashboard...
            </div>
          )}

          {!success && (
            <>
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">Password Baru</label>
                <div className="relative">
                  <input
                    type={showPw ? 'text' : 'password'}
                    required
                    minLength={8}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="input-base pr-10"
                    placeholder="Minimal 8 karakter"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw(!showPw)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-600"
                  >
                    {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">Konfirmasi Password Baru</label>
                <input
                  type={showPw ? 'text' : 'password'}
                  required
                  minLength={8}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  className="input-base"
                  placeholder="Ulangi password baru"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full btn-primary justify-center py-2.5"
              >
                {submitting ? 'Menyimpan...' : 'Simpan Password Baru'}
              </button>
            </>
          )}
        </form>
      </div>
    </div>
  )
}