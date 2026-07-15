import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { supabase, isOAuthCallback } from '../lib/supabaseClient'
import type { User, AuthError } from '@supabase/supabase-js'

interface AuthContextValue {
  user: User | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ error: AuthError | null }>
  signUp: (email: string, password: string) => Promise<{ error: AuthError | null }>
  signOut: () => Promise<void>
  signInWithGoogle: () => Promise<{ error: AuthError | null }>
  resetPassword: (email: string) => Promise<{ error: AuthError | null }>
  updatePassword: (password: string) => Promise<{ error: AuthError | null }>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    console.log('[AuthContext] Init, isOAuthCallback:', isOAuthCallback)

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('[AuthContext] Event:', event, 'User:', session?.user?.email || null)
      setUser(session?.user ?? null)

      if (event === 'INITIAL_SESSION') {
        // OAuth callback — PKCE exchange not done yet.
        // Skip setLoading(false); wait for SIGNED_IN.
        if (isOAuthCallback) {
          console.log('[AuthContext] OAuth callback detected, waiting for SIGNED_IN...')
          return
        }

        // Normal page load — session (or null) already resolved.
        console.log('[AuthContext] Normal load, setting loading=false')
        setLoading(false)
        return
      }

      // SIGNED_IN / SIGNED_OUT / TOKEN_REFRESHED
      console.log('[AuthContext] Auth event resolved, setting loading=false')
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error }
  }

  const signUp = async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({ email, password })
    return { error }
  }

  const signInWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/dashboard` }
    })
    return { error }
  }

  const signOut = async () => {
    await supabase.auth.signOut()
  }

  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    return { error }
  }

  const updatePassword = async (password: string) => {
    const { error } = await supabase.auth.updateUser({ password })
    return { error }
  }

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signUp, signOut, signInWithGoogle, resetPassword, updatePassword }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}