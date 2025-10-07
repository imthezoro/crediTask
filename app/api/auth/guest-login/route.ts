import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const admin = createAdminClient()

    // Sign in anonymously using Supabase
    const { data: authData, error: authError } = await supabase.auth.signInAnonymously()

    if (authError) {
      console.error('Anonymous auth error:', authError)
      
      // Handle rate limit errors specifically
      if (authError.message?.includes('rate limit') || authError.message?.includes('too many requests')) {
        return NextResponse.json(
          { 
            success: false, 
            error: 'Too many guest login attempts. Please try again later.',
            errorType: 'RATE_LIMIT'
          },
          { status: 429 }
        )
      }

      // Handle other auth errors
      return NextResponse.json(
        { success: false, error: 'Failed to create guest session' },
        { status: 400 }
      )
    }

    if (!authData.user) {
      return NextResponse.json(
        { success: false, error: 'No user data returned' },
        { status: 400 }
      )
    }

    // Create or update user profile for guest
    const { error: profileError } = await admin
      .from('user_profiles')
      .upsert({
        id: authData.user.id,
        is_guest: true,
        is_active: true,
        plan: 'free',
        usage_count: 0,
        prompt_limit: 5,
        created_at: new Date().toISOString()
      }, {
        onConflict: 'id',
        ignoreDuplicates: false
      })

    if (profileError) {
      console.error('Profile creation error:', profileError)
      // Don't fail the request - profile might already exist
    }

    // Log the guest creation for audit
    await admin.from('audit_logs').insert({
      user_id: authData.user.id,
      action: 'guest_login',
      entity_type: 'user_profile',
      entity_id: authData.user.id,
      details: {
        user_agent: request.headers.get('user-agent'),
        anonymous: true
      },
      is_guest: true,
      performed_at: new Date().toISOString(),
      ip_address: request.headers.get('x-forwarded-for')?.split(',')[0] || 
                  request.headers.get('x-real-ip') || 
                  'unknown'
    })

    return NextResponse.json({
      success: true,
      message: 'Guest session created successfully',
      user: {
        id: authData.user.id,
        is_anonymous: true,
        is_guest: true
      }
    })

  } catch (error) {
    console.error('Guest login error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
