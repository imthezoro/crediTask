import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase-server'
import { securityMiddleware, addSecurityHeaders, getClientIP } from '@/lib/security-middleware'
import { signupSchema, validateRequest, sanitizeEmail } from '@/lib/validation'
import { SecureAuthUtils } from '@/lib/secure-auth-utils'

export async function POST(request: NextRequest) {
  // Apply security middleware
  const securityCheck = await securityMiddleware(request, 'signup', {
    requireOriginValidation: true,
    rateLimitType: 'auth'
  })
  
  if (!securityCheck.allowed) {
    return addSecurityHeaders(securityCheck.response!)
  }

  try {
    const body = await request.json()
    
    // Validate request body
    const validation = validateRequest(signupSchema, body)
    if (!validation.success) {
      // Add delay for validation errors to prevent timing analysis
      await SecureAuthUtils.addRandomDelay(200)
      
      const response = NextResponse.json(
        { error: 'Invalid input data' },
        { status: 400 }
      )
      return addSecurityHeaders(response)
    }

    const { email, password } = validation.data!
    const clientIP = getClientIP(request)
    const userAgent = request.headers.get('user-agent') || ''
    const normalizedEmail = sanitizeEmail(email)

    // Check if email is currently blocked
    const admin = createAdminClient()
    const { data: blockedEmail } = await admin
      .from('blocked_emails')
      .select('blocked_until, reason')
      .eq('email', normalizedEmail)
      .gt('blocked_until', new Date().toISOString())
      .single()

    if (blockedEmail) {
      // Add delay to prevent timing analysis
      await SecureAuthUtils.addRandomDelay(300)
      
      const blockedUntilDate = new Date(blockedEmail.blocked_until)
      const daysRemaining = Math.max(1, Math.ceil((blockedUntilDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
      const hoursRemaining = Math.max(1, Math.ceil((blockedUntilDate.getTime() - Date.now()) / (1000 * 60 * 60)))
      
      let timeMessage = ''
      if (daysRemaining > 1) {
        timeMessage = `${daysRemaining} days`
      } else {
        timeMessage = `${hoursRemaining} hours`
      }
      
      const response = NextResponse.json(
        { error: `This email is blocked due to account deletion. Please wait ${timeMessage} before creating a new account, or contact support.` },
        { status: 403 }
      )
      return addSecurityHeaders(response)
    }

    // Clean up any expired email blocks
    await admin
      .from('blocked_emails')
      .delete()
      .eq('email', normalizedEmail)
      .lt('blocked_until', new Date().toISOString())

    // Proceed with Supabase signup
    const supabase = await createClient()
    const { data, error } = await supabase.auth.signUp({
      email: normalizedEmail,
      password,
      options: {
        emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback`
      }
    })

    if (error) {
      // Add delay for errors to prevent timing analysis
      console.error('Signup error:', error)
      await SecureAuthUtils.addRandomDelay(300)
      
      let errorMessage = 'Signup failed'
      if (error.message.includes('already registered')) {
        errorMessage = 'Email already registered'
      }
      
      const response = NextResponse.json(
        { error: errorMessage },
        { status: 400 }
      )
      return addSecurityHeaders(response)
    }

    // Log successful signup attempt
    await SecureAuthUtils.logAuthAttempt(
      normalizedEmail,
      true,
      clientIP,
      userAgent,
      data.user?.id
    )

    const response = NextResponse.json({
      success: true,
      message: 'Signup successful. Please check your email for confirmation.',
      data: data.user ? {
        id: data.user.id,
        email: data.user.email
      } : null
    })

    return addSecurityHeaders(response)

  } catch (error) {
    console.error('Signup API error:', error)
    
    // Add random delay for server errors
    await SecureAuthUtils.addRandomDelay(300)
    
    const response = NextResponse.json(
      { error: 'Signup failed' },
      { status: 500 }
    )
    return addSecurityHeaders(response)
  }
}
