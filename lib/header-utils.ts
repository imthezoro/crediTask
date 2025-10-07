import { createClient, isUserAdmin } from '@/lib/supabase/server'

export interface HeaderData {
  user: {
    id: string
    email?: string
  } | null
  isAdmin: boolean
  isActive: boolean
}

export async function getHeaderData(): Promise<HeaderData> {
  const supabase = await createClient()
  
  try {
    // Get the current user
    const { data: { user }, error } = await supabase.auth.getUser()
    
    if (error || !user) {
      return { user: null, isAdmin: false, isActive: false }
    }

    // Get user profile status
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('is_active')
      .eq('id', user.id)
      .single()

    if (!profile?.is_active) {
      return { user: null, isAdmin: false, isActive: false }
    }

    // Check admin status
    const userIsAdmin = await isUserAdmin(user.id)

    return {
      user: {
        id: user.id,
        email: user.email,
      },
      isAdmin: userIsAdmin,
      isActive: true,
    }
  } catch (error) {
    console.error('Header data fetch error:', error)
    return { user: null, isAdmin: false, isActive: false }
  }
}
