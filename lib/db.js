import 'server-only'
import { createClient } from '@supabase/supabase-js'

let client
export function db() {
  if (!client) {
    const url = process.env.SUPABASE_URL
    const key = process.env.SUPABASE_SECRET_KEY
    if (!url || !key) throw new Error('SUPABASE_URL and SUPABASE_SECRET_KEY must be set in .env.local')
    client = createClient(url, key, { auth: { persistSession: false } })
  }
  return client
}

/** Throws with a readable message when Supabase returns an error. */
export function check({ data, error }, what) {
  if (error) {
    if (error.code === 'PGRST205' || /does not exist|schema cache/i.test(error.message)) {
      throw new Error('SETUP: The database tables are missing. Run supabase/schema.sql in the Supabase SQL editor.')
    }
    throw new Error(`${what}: ${error.message}`)
  }
  return data
}
