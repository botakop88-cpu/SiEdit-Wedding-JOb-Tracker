import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Suspense, lazy } from 'react'
import { AuthProvider, useAuth } from './lib/AuthContext'
import ErrorBoundary from './components/ErrorBoundary'
import AppLayout from './components/AppLayout'
import Login from './pages/Login'
import Register from './pages/Register'
import ForgotPassword from './pages/ForgotPassword'
import ResetPassword from './pages/ResetPassword'

// Lazy load heavy pages
const Dashboard = lazy(() => import('./pages/Dashboard'))
const Jobs = lazy(() => import('./pages/Jobs'))
const Vendors = lazy(() => import('./pages/Vendors'))
const Invoices = lazy(() => import('./pages/Invoices'))
const Settings = lazy(() => import('./pages/Settings'))

function LoadingFallback() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-8 w-8 border-4 border-rose-500 border-t-transparent" />
    </div>
  )
}

function CatchAll() {
  const { user, loading } = useAuth()
  if (loading) return null
  return <Navigate to={user ? '/dashboard' : '/login'} replace />
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ErrorBoundary>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route element={<AppLayout />}>
              <Route path="/dashboard" element={<Suspense fallback={<LoadingFallback />}><Dashboard /></Suspense>} />
              <Route path="/jobs" element={<Suspense fallback={<LoadingFallback />}><Jobs /></Suspense>} />
              <Route path="/vendors" element={<Suspense fallback={<LoadingFallback />}><Vendors /></Suspense>} />
              <Route path="/invoices" element={<Suspense fallback={<LoadingFallback />}><Invoices /></Suspense>} />
              <Route path="/settings" element={<Suspense fallback={<LoadingFallback />}><Settings /></Suspense>} />
            </Route>
            <Route path="*" element={<CatchAll />} />
          </Routes>
        </ErrorBoundary>
      </AuthProvider>
    </BrowserRouter>
  )
}