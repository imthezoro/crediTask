import { NextResponse } from 'next/server'
import { createServerClient, createAdminClient } from '@/lib/supabase-server'

export async function POST() {
  try {
    const supabase = createServerClient()
    
    // Get current user from server-bound client
    const { data: { user }, error } = await supabase.auth.getUser()
    
    if (error || !user) {
      return NextResponse.json({ valid: false, reason: 'no_session' }, { status: 401 })
    }

    // Check if user profile is active using admin client (bypass RLS)
    const admin = createAdminClient()
    const { data: profile, error: profileErr } = await admin
      .from('user_profiles')
      .select('is_active, deleted_at')
      .eq('id', user.id)
      .single()

    if (profileErr) {
      // If no row found (e.g., PGRST116) or any read issue, treat as deactivated
      console.warn('Profile validation warning (treat as deactivated):', profileErr)
      return NextResponse.json({ 
        valid: false, 
        reason: 'deactivated',
        message: 'This account has been deactivated. Please create a new account to continue.'
      }, { status: 403 })
    }

    if (!profile || !profile.is_active) {
      // Account is deactivated - client should sign out and show message
      return NextResponse.json({ 
        valid: false, 
        reason: 'deactivated',
        message: 'This account has been deactivated. Please create a new account to continue.',
        deleted_at: profile?.deleted_at
      }, { status: 403 })
    }

    // Session is valid and profile is active
    return NextResponse.json({ valid: true })
    
  } catch (error) {
    console.error('Session validation failed:', error)
    return NextResponse.json({ 
      valid: false, 
      reason: 'server_error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
