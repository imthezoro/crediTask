import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

// Server-side client that reads user session from cookies
export const createServerClient = () => {
  const cookieStore = cookies()
  const accessToken = cookieStore.get('sb-access-token')?.value
  
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    },
    global: {
      headers: {
        'apikey': supabaseAnonKey,
        ...(accessToken ? { 'Authorization': `Bearer ${accessToken}` } : {})
      }
    }
  })
}

// Admin client with service role key for admin operations only
export const createAdminClient = () => {
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })
}

// Helper to check if user is admin
export async function isUserAdmin(userId: string): Promise<boolean> {
  const supabase = createAdminClient()
  
  const { data, error } = await supabase
    .from('user_profiles')
    .select('is_admin')
    .eq('id', userId)
    .single()
    
  if (error || !data) return false
  return !!(data as { is_admin?: boolean }).is_admin
}

// Helper: get a single user's email by ID via Admin API
export async function getUserEmailById(userId: string): Promise<string | null> {
  try {
    const admin = createAdminClient()
    const { data } = await admin.auth.admin.getUserById(userId)
    return data?.user?.email ?? null
  } catch {
    return null
  }
}

// Helper: build an ID->email map for a set of user IDs via Admin API
export async function getUserEmailsMap(userIds: string[]): Promise<Record<string, string>> {
  const uniqueIds = Array.from(new Set(userIds.filter(Boolean))) as string[]
  const result: Record<string, string> = {}
  for (const id of uniqueIds) {
    const email = await getUserEmailById(id)
    if (email) result[id] = email
  }
  return result
}
