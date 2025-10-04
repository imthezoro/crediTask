import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { appConfig } from '../config'

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    appConfig.supabase.url,
    appConfig.supabase.anonKey,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // The `setAll` method was called from a Server Component.
          }
        },
      },
    }
  )
}

// Admin client for server-side operations that require elevated privileges
export function createAdminClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceRoleKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set')
  }

  return createServerClient(
    appConfig.supabase.url,
    serviceRoleKey,
    {
      cookies: {
        getAll: () => [],
        setAll: () => {},
      },
    }
  )
}

// Check if user is admin
export async function isUserAdmin(userId: string): Promise<boolean> {
  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('user_profiles')
    .select('is_admin')
    .eq('id', userId)
    .single()
  
  return Boolean(profile?.is_admin)
}

// Get user emails map for admin operations
export async function getUserEmailsMap(): Promise<Record<string, string>> {
  const admin = createAdminClient()
  const { data: profiles } = await admin
    .from('user_profiles')
    .select('id, email')
  
  const emailMap: Record<string, string> = {}
  profiles?.forEach(profile => {
    if (profile.id && profile.email) {
      emailMap[profile.id] = profile.email
    }
  })
  
  return emailMap
}
