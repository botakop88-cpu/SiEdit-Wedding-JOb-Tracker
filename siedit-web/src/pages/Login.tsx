import { useState, type FormEvent } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { Camera, Eye, EyeOff } from 'lucide-react'
import { useAuth } from '../lib/AuthContext'

export default function Login() {
  const { user, loading, signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  if (loading) return null
  if (user) return <Navigate to="/dashboard" replace />

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    const { error: err } = await signIn(email.trim(), password)
    if (err) setError(err.message === 'Invalid login credentials'
      ? 'Email atau password salah.'
      : err.message)
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
          <h2 className="text-xl font-semibold text-slate-800">Masuk</h2>

          {error && (
            <div className="bg-red-50 text-red-600 text-sm rounded-lg px-4 py-3">{error}</div>
          )}

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

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
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

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-rose-600 hover:bg-rose-700 disabled:opacity-60 text-white font-medium rounded-lg py-2.5 text-sm transition-colors"
          >
            {submitting ? 'Masuk...' : 'Masuk'}
          </button>

          <p className="text-center">
            <Link to="/forgot-password" className="text-xs text-slate-400 hover:text-rose-600">
              Lupa password?
            </Link>
          </p>

          <p className="text-center text-sm text-slate-500">
            Belum punya akun?{' '}
            <Link to="/register" className="text-rose-600 font-medium hover:underline">
              Daftar
            </Link>
          </p>
        </form>
      </div>
    </div>
  )
}