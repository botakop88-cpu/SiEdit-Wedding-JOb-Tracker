import { useState, type FormEvent } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { Camera, Mail } from 'lucide-react'
import { useAuth } from '../lib/AuthContext'

export default function ForgotPassword() {
  const { user, loading, resetPassword } = useAuth()
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  if (loading) return null
  if (user) return <Navigate to="/dashboard" replace />

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    const { error: err } = await resetPassword(email.trim())
    if (err) setError(err.message)
    else setSent(true)
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
          <h2 className="text-xl font-bold text-slate-900">Lupa Password</h2>

          {error && (
            <div className="bg-red-500/10 text-red-300 border border-red-500/25 text-sm rounded-xl px-4 py-3">{error}</div>
          )}

          {sent ? (
            <div className="space-y-3">
              <div className="bg-emerald-500/10 text-emerald-300 border border-emerald-500/25 text-sm rounded-xl px-4 py-3">
                Tautan reset password telah dikirim ke <strong>{email.trim()}</strong>. Silakan cek inbox (dan folder spam) Anda.
              </div>
              <Link
                to="/login"
                className="block text-center text-sm text-rose-400 font-medium hover:underline"
              >
                Kembali ke Login
              </Link>
            </div>
          ) : (
            <>
              <p className="text-sm text-slate-600">
                Masukkan email terdaftar Anda. Kami akan mengirim tautan untuk mengatur password baru.
              </p>
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">Email</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input-base"
                  placeholder="nama@email.com"
                />
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="w-full btn-primary justify-center py-2.5"
              >
                <Mail className="w-4 h-4" />
                {submitting ? 'Mengirim...' : 'Kirim Tautan Reset'}
              </button>
            </>
          )}

          {!sent && (
            <p className="text-center text-sm text-slate-600">
              Ingat password?{' '}
              <Link to="/login" className="text-rose-400 font-medium hover:underline">
                Masuk
              </Link>
            </p>
          )}
        </form>
      </div>
    </div>
  )
}