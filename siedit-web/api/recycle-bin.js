import { createClient } from '@supabase/supabase-js'

async function getUserFromToken(supabase, token) {
  const { data: { user }, error } = await supabase.auth.getUser(token)
  if (error || !user) return null
  return user
}

export default async function handler(req, res) {
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
  const user = await getUserFromToken(supabase, token)
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized: invalid token' })
  }

  const allowedTables = ['job', 'vendor', 'invoice']

  if (req.method === 'GET') {
    // Load deleted items: table=job
    const { table } = req.query
    if (!table || !allowedTables.includes(table)) {
      return res.status(400).json({ error: 'Invalid table' })
    }

    const { data, error } = await supabase
      .from(table)
      .select('*')
      .not('deleted_at', 'is', null)
      .eq('user_id', user.id)
      .order('deleted_at', { ascending: false })

    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ data: data ?? [] })
  }

  if (req.method === 'PUT') {
    // Restore: table?id=xxx
    const { table, id } = req.query
    if (!table || !id) return res.status(400).json({ error: 'Missing table or id' })
    if (!allowedTables.includes(table)) {
      return res.status(400).json({ error: 'Invalid table' })
    }

    const { error } = await supabase
      .from(table)
      .update({ deleted_at: null })
      .eq('id', id)
      .eq('user_id', user.id)

    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ ok: true })
  }

  if (req.method === 'DELETE') {
    // Hard delete or empty trash
    const { table, id, all } = req.query

    if (all === 'true') {
      // Empty trash for specific table
      if (!table || !allowedTables.includes(table)) {
        return res.status(400).json({ error: 'Invalid table' })
      }
      const { error } = await supabase
        .from(table)
        .delete()
        .not('deleted_at', 'is', null)
        .eq('user_id', user.id)
      if (error) return res.status(500).json({ error: error.message })
      return res.status(200).json({ ok: true })
    }

    if (!table || !id) return res.status(400).json({ error: 'Missing table or id' })
    if (!allowedTables.includes(table)) {
      return res.status(400).json({ error: 'Invalid table' })
    }

    const { error } = await supabase
      .from(table)
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)

    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ ok: true })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
