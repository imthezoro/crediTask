import { createClient } from '@/lib/supabase-server'
import { NextRequest, NextResponse } from 'next/server'
import { securityMiddleware, addSecurityHeaders, rateLimiter, getClientIP } from '@/lib/security-middleware'
import { loginSchema, validateRequest } from '@/lib/validation'
import { SecurityUtils } from '@/lib/security-utils'

export async function POST(request: NextRequest) {
  // Apply security middleware
  const securityCheck = await securityMiddleware(request, 'login', {
    requireOriginValidation: true,
    rateLimitType: 'auth'
  })
  
  if (!securityCheck.allowed) {
    return addSecurityHeaders(securityCheck.response!)
  }

  try {
    const body = await request.json()
    
    // Validate request body
    const validation = validateRequest(loginSchema, body)
    if (!validation.success) {
      const response = NextResponse.json(
        { error: validation.error },
        { status: 400 }
      )
      return addSecurityHeaders(response)
    }

    const { email, password } = validation.data!
    const supabase = await createClient()

    // Attempt authentication
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password
    })

    if (authError || !authData.user) {
      const response = NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      )
      return addSecurityHeaders(response)
    }

    // Check if user profile is active
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('is_active, full_name')
      .eq('id', authData.user.id)
      .single()

    if (profileError || !profile) {
      // Sign out the user if profile check fails
      await supabase.auth.signOut()
      const response = NextResponse.json(
        { error: 'Account not found. Please create a new account.' },
        { status: 404 }
      )
      return addSecurityHeaders(response)
    }

    if (!profile.is_active) {
      // Sign out inactive users
      await supabase.auth.signOut()
      const response = NextResponse.json(
        { error: 'This account has been deactivated. Please create a new account to continue.' },
        { status: 403 }
      )
      return addSecurityHeaders(response)
    }

    // Record successful login for rate limiting using SecurityUtils
    const clientIP = getClientIP(request)
    const userAgent = request.headers.get('user-agent') || ''
    const identifier = SecurityUtils.generateRateLimitKey(clientIP, userAgent, 'login')
    rateLimiter.recordSuccess(identifier, 'login', 'auth')

    const response = NextResponse.json({
      success: true,
      message: 'Login successful',
      user: {
        id: authData.user.id,
        email: authData.user.email,
        full_name: profile.full_name
      }
    })

    return addSecurityHeaders(response)

  } catch (error) {
    console.error('Login API error:', error)
    const response = NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
    return addSecurityHeaders(response)
  }
}
