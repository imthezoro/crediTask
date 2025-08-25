import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, createAdminClient } from '@/lib/supabase-server'
import { createClient } from '@supabase/supabase-js'

export async function POST(req: NextRequest) {
  try {
    // Try to use Authorization header if provided (client-side validation after OAuth)
    const authHeader = req.headers.get('authorization')
    const usingBearer = !!(authHeader && authHeader.toLowerCase().startsWith('bearer '))
    if (process.env.NODE_ENV !== 'production') {
      console.log('[validate-session] usingBearer:', usingBearer)
    }
    const supabase = usingBearer
      ? createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
          auth: { persistSession: false, autoRefreshToken: false },
          global: { headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY! } }
        })
      : createServerClient()
    
    // Get current user from server-bound client
    let user = null as any
    let error: any = null
    if (usingBearer) {
      const token = authHeader!.slice('bearer '.length)
      const { data, error: uErr } = await supabase.auth.getUser(token)
      user = data?.user || null
      error = uErr || null
      if (uErr && process.env.NODE_ENV !== 'production') console.warn('[validate-session] getUser(bearer) error:', uErr)
    } else {
      const { data, error: uErr } = await supabase.auth.getUser()
      user = data?.user || null
      error = uErr || null
      if (uErr && process.env.NODE_ENV !== 'production') console.warn('[validate-session] getUser(cookie) error:', uErr)
    }
    
    if (error || !user) {
      return NextResponse.json({ 
        valid: false, 
        reason: 'no_session',
        source: usingBearer ? 'bearer' : 'cookie'
      }, { status: 401 })
    }

    // Check if user profile is active using admin client (bypass RLS)
    const admin = createAdminClient()
    const { data: profile, error: profileErr } = await admin
      .from('user_profiles')
      .select('is_active, deleted_at')
      .eq('id', user.id)
      .single()

    // Handle missing profile (first-time OAuth user)
    if (profileErr && profileErr.code === 'PGRST116') {
      // No profile exists - check if email is blocked before creating
      if (user.email) {
        const blockStatus = await checkBlockedEmail(admin, user.email)
        if (blockStatus.blocked) {
          return NextResponse.json({ 
            valid: false, 
            reason: 'deactivated',
            message: blockStatus.message
          }, { status: 403 })
        }
      }
      
      // Create new profile for first-time OAuth user
      const { error: createErr } = await admin
        .from('user_profiles')
        .insert({
          id: user.id,
          email: user.email,
          is_active: true,
          created_at: new Date().toISOString()
        })
      
      if (createErr) {
        if (process.env.NODE_ENV !== 'production') console.error('Failed to create profile for OAuth user:', createErr)
        return NextResponse.json({ 
          valid: false, 
          reason: 'server_error',
          message: 'Failed to create user profile'
        }, { status: 500 })
      }
      
      return NextResponse.json({ valid: true })
    }

    if (profileErr) {
      if (process.env.NODE_ENV !== 'production') console.warn('Profile validation error:', profileErr)
      return NextResponse.json({ 
        valid: false, 
        reason: 'deactivated',
        message: 'This account has been deactivated. Please create a new account to continue.'
      }, { status: 403 })
    }

    if (!profile || !profile.is_active) {
      // Account is deactivated - check if block has expired and can be reactivated
      if (user.email) {
        const blockStatus = await checkBlockedEmail(admin, user.email)
        
        if (blockStatus.blocked) {
          // Still blocked - deny access
          return NextResponse.json({ 
            valid: false, 
            reason: 'deactivated',
            message: blockStatus.message
          }, { status: 403 })
        } else {
          // Block expired or doesn't exist - reactivate the account
          const { error: reactivateErr } = await admin
            .from('user_profiles')
            .update({ 
              is_active: true, 
              deleted_at: null,
              reactivated_at: new Date().toISOString()
            })
            .eq('id', user.id)
          
          if (reactivateErr) {
            if (process.env.NODE_ENV !== 'production') console.error('Failed to reactivate profile:', reactivateErr)
            return NextResponse.json({ 
              valid: false, 
              reason: 'server_error',
              message: 'Failed to reactivate account'
            }, { status: 500 })
          }
          
          // Clean up expired block record
          if (blockStatus.hadExpiredBlock) {
            await admin
              .from('blocked_emails')
              .delete()
              .eq('email', user.email)
          }
          
          if (process.env.NODE_ENV !== 'production') console.log(`Reactivated account for user ${user.id} (${user.email})`)
          return NextResponse.json({ valid: true })
        }
      } else {
        // No email to check blocks - deny access
        return NextResponse.json({ 
          valid: false, 
          reason: 'deactivated',
          message: 'This account has been deactivated. Please create a new account to continue.'
        }, { status: 403 })
      }
    }

    // Session is valid and profile is active
    return NextResponse.json({ valid: true })
    
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') console.error('Session validation failed:', error)
    return NextResponse.json({ 
      valid: false, 
      reason: 'server_error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

async function checkBlockedEmail(admin: any, email: string): Promise<{
  blocked: boolean
  message?: string
  hadExpiredBlock?: boolean
}> {
  try {
    const { data, error } = await admin
      .from('blocked_emails')
      .select('blocked_until')
      .eq('email', email)
      .single()

    if (error && error.code !== 'PGRST116') {
      console.error('Error checking blocked_emails:', error)
      // On error, be conservative and allow access
      return { blocked: false }
    }

    if (!data) {
      // No block record exists
      return { blocked: false }
    }

    const blockedUntil = new Date(data.blocked_until)
    const now = new Date()

    if (blockedUntil > now) {
      // Still blocked
      return {
        blocked: true,
        message: `This email was recently used for a deactivated account and can't be reused until ${blockedUntil.toLocaleString()}`
      }
    } else {
      // Block has expired
      return {
        blocked: false,
        hadExpiredBlock: true
      }
    }
  } catch (error) {
    console.error('Error in checkBlockedEmail:', error)
    // On error, be conservative and allow access
    return { blocked: false }
  }
}
