import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY environment variables. ' +
    'Copy .env.example to .env and fill in your Supabase project details.'
  )
}

// Check BEFORE createClient clears URL (hash or query)
// Supabase v2 PKCE flow uses hash fragments: /dashboard#access_token=xxx&...
// Older PKCE or implicit flow can use query params: /dashboard?code=xxx
const url = new URL(window.location.href)
const hashHasTokens = url.hash.includes('access_token=') || url.hash.includes('code=')
const queryHasCode = url.searchParams.has('code') || url.searchParams.has('access_token')
export const isOAuthCallback = hashHasTokens || queryHasCode

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
