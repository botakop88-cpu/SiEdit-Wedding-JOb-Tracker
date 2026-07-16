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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-rose-900 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-rose-600 mb-4">
            <Camera className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white">SiEdit</h1>
          <p className="text-slate-400 mt-1">Wedding Job Tracker</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-xl p-8 space-y-5">
          <h2 className="text-xl font-semibold text-slate-800">Atur Password Baru</h2>

          {error && (
            <div className="bg-red-50 text-red-600 text-sm rounded-lg px-4 py-3">{error}</div>
          )}
          {success && (
            <div className="bg-green-50 text-green-700 text-sm rounded-lg px-4 py-3">
              Password berhasil diubah! Mengarahkan ke dashboard...
            </div>
          )}

          {!success && (
            <>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Password Baru</label>
                <div className="relative">
                  <input
                    type={showPw ? 'text' : 'password'}
                    required
                    minLength={8}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent pr-10"
                    placeholder="Minimal 8 karakter"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw(!showPw)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Konfirmasi Password Baru</label>
                <input
                  type={showPw ? 'text' : 'password'}
                  required
                  minLength={8}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent"
                  placeholder="Ulangi password baru"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-rose-600 hover:bg-rose-700 disabled:opacity-60 text-white font-medium rounded-lg py-2.5 text-sm transition-colors"
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