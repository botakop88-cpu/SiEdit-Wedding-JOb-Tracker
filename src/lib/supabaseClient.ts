import { createClient } from '@supabase/supabase-js'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createMockClient } from './mockClient'

const PREVIEW_MODE = import.meta.env.VITE_PREVIEW_MODE === 'true'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!PREVIEW_MODE && (!supabaseUrl || !supabaseAnonKey)) {
  throw new Error(
    'Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY environment variables. ' +
    'Copy .env.example to .env and fill in your Supabase project details.'
  )
}

export const supabase = (PREVIEW_MODE ? createMockClient() : createClient(supabaseUrl!, supabaseAnonKey!)) as unknown as SupabaseClient