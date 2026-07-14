import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://awvtthczpoeychzfnypd.supabase.co'
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF3dnR0aGN6cG9leWNoemZueXBkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM5OTY4NjIsImV4cCI6MjA5OTU3Mjg2Mn0.2GGftrpjyle1iCbLaclXZSWQcmQs-j6iPjyBA17ZwLc'

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY environment variables. ' +
    'Copy .env.example to .env and fill in your Supabase project details.'
  )
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)