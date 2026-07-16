import { createClient } from '@supabase/supabase-js'

export default async function handler(req, res) {
  if (req.method !== 'DELETE') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { id } = req.query
  if (!id) {
    return res.status(400).json({ error: 'Missing invoice id' })
  }

  // Extract JWT token from Authorization header
  const authHeader = req.headers.authorization
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: missing token' })
  }
  const token = authHeader.replace('Bearer ', '')

  const supabaseUrl = process.env.SUPABASE_URL
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    return res.status(500).json({ error: 'Missing env vars' })
  }

  // Create client with anon key + user JWT (RLS will enforce user_id)
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } }
  })

  // Verify token and get user
  const { data: { user }, error: authError } = await supabase.auth.getUser(token)
  if (authError || !user) {
    return res.status(401).json({ error: 'Unauthorized: invalid token' })
  }

  const { error } = await supabase
    .from('invoice')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) {
    return res.status(500).json({ error: error.message })
  }

  return res.status(200).json({ ok: true })
}
