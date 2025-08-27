import { createClient } from '@/lib/supabase-server'
import { NextRequest, NextResponse } from 'next/server'
import { deleteAccountSchema, validateRequest } from '@/lib/validation'
import { securityMiddleware, addSecurityHeaders, rateLimiter, getClientIP } from '@/lib/security-middleware'
import { SecurityUtils } from '@/lib/security-utils'

export async function POST(request: NextRequest) {
  // Apply security middleware
  const securityCheck = await securityMiddleware(request, 'delete-account', {
    requireOriginValidation: true,
    rateLimitType: 'auth-sensitive'
  })
  
  if (!securityCheck.allowed) {
    return addSecurityHeaders(securityCheck.response!)
  }

  try {
    const body = await request.json()
    
    // Validate request body
    const validation = validateRequest(deleteAccountSchema, body)
    if (!validation.success) {
      const response = NextResponse.json(
        { error: validation.error },
        { status: 400 }
      )
      return addSecurityHeaders(response)
    }
    
    const { userId, userEmail, isGuest } = validation.data!

    const supabase = await createClient()

    // Use proper Supabase session management instead of manual token parsing
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user || user.id !== userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Additional security: verify user profile is active
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('is_active')
      .eq('id', user.id)
      .single()

    if (profileError || !profile?.is_active) {
      return NextResponse.json(
        { error: 'Account is not active' },
        { status: 403 }
      )
    }

    // Call the Edge Function for secure soft deletion
    const { data, error } = await supabase.functions.invoke('soft-delete-user', {
      body: {
        userId,
        userEmail,
        isGuest,
        requestedBy: user.id
      }
    })

    if (error) {
      console.error('Edge function error:', error)
      return NextResponse.json(
        { error: 'Failed to delete account' },
        { status: 500 }
      )
    }

    // Record successful operation for rate limiting using SecurityUtils
    const clientIP = getClientIP(request)
    const userAgent = request.headers.get('user-agent') || ''
    const identifier = SecurityUtils.generateRateLimitKey(clientIP, userAgent, 'delete-account')
    rateLimiter.recordSuccess(identifier, 'delete-account', 'auth-sensitive')
    
    const response = NextResponse.json({
      success: true,
      message: 'Account has been successfully deactivated',
      data
    })
    
    return addSecurityHeaders(response)

  } catch (error) {
    console.error('Delete account API error:', error)
    const response = NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
    return addSecurityHeaders(response)
  }
}
