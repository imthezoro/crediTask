import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
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
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
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
