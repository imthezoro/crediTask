import { createClient } from '@/lib/supabase-server'
import { NextRequest, NextResponse } from 'next/server'
import { deleteAccountSchema, validateRequest } from '@/lib/validation'
import { securityMiddleware, addSecurityHeaders, rateLimiter, getClientIP } from '@/lib/security'
import { SecurityUtils } from '@/lib/security-utils'
import { hardDeleteService } from '@/lib/hard-delete-service'

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
    
    const { userId } = validation.data!

    const supabase = await createClient()

    // Use proper Supabase session management instead of manual token parsing
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user || user.id !== userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Additional security: verify user profile exists and prevent guest deletion
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('id, is_guest')
      .eq('id', user.id)
      .single()

    if (profileError || !profile) {
      return NextResponse.json(
        { error: 'User profile not found' },
        { status: 404 }
      )
    }

    // Prevent guest users from deleting accounts
    if (profile.is_guest) {
      return NextResponse.json(
        { error: 'Guest accounts cannot be permanently deleted' },
        { status: 403 }
      )
    }

    // Hard delete user and block email
    const clientIP = getClientIP(request)
    const userAgent = request.headers.get('user-agent') || ''
    
    await hardDeleteService.hardDeleteUser(userId, {
      reason: 'User account deletion',
      performedBy: 'user',
      ipAddress: clientIP,
      userAgent
    })

    // Record successful operation for rate limiting using SecurityUtils
    const identifier = await SecurityUtils.generateRateLimitKey(clientIP, userAgent, 'delete-account')
    rateLimiter.recordSuccess(identifier, 'delete-account', 'auth-sensitive')
    
    const response = NextResponse.json({
      success: true,
      message: 'Account permanently deleted. Email blocked for reuse.'
    })
    
    return addSecurityHeaders(response)

  } catch (error) {
    console.error('Delete account API error:', error)
    const response = NextResponse.json(
      { error: 'Account deletion failed' },
      { status: 500 }
    )
    return addSecurityHeaders(response)
  }
}
