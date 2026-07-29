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
          <h2 className="text-xl font-semibold text-slate-800">Lupa Password</h2>

          {error && (
            <div className="bg-red-50 text-red-600 text-sm rounded-lg px-4 py-3">{error}</div>
          )}

          {sent ? (
            <div className="space-y-3">
              <div className="bg-green-50 text-green-700 text-sm rounded-lg px-4 py-3">
                Tautan reset password telah dikirim ke <strong>{email.trim()}</strong>. Silakan cek inbox (dan folder spam) Anda.
              </div>
              <Link
                to="/login"
                className="block text-center text-sm text-rose-600 font-medium hover:underline"
              >
                Kembali ke Login
              </Link>
            </div>
          ) : (
            <>
              <p className="text-sm text-slate-500">
                Masukkan email terdaftar Anda. Kami akan mengirim tautan untuk mengatur password baru.
              </p>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent"
                  placeholder="nama@email.com"
                />
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-rose-600 hover:bg-rose-700 disabled:opacity-60 text-white font-medium rounded-lg py-2.5 text-sm transition-colors flex items-center justify-center gap-2"
              >
                <Mail className="w-4 h-4" />
                {submitting ? 'Mengirim...' : 'Kirim Tautan Reset'}
              </button>
            </>
          )}

          {!sent && (
            <p className="text-center text-sm text-slate-500">
              Ingat password?{' '}
              <Link to="/login" className="text-rose-600 font-medium hover:underline">
                Masuk
              </Link>
            </p>
          )}
        </form>
      </div>
    </div>
  )
}