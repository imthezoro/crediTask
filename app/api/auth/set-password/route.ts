import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { securityMiddleware, addSecurityHeaders, getClientIP } from '@/lib/security'
import { setPasswordSchema, validateRequest } from '@/lib/validation'
import { SecureAuthUtils } from '@/lib/secure-auth-utils'

export async function POST(request: NextRequest) {
  const securityCheck = await securityMiddleware(request, 'set-password', {
    requireOriginValidation: true,
    rateLimitType: 'auth-sensitive'
  })
  
  if (!securityCheck.allowed) {
    return addSecurityHeaders(securityCheck.response!)
  }

  try {
    const body = await request.json()
    
    // Validate request body using schema
    const validation = validateRequest(setPasswordSchema, body)
    if (!validation.success) {
      await SecureAuthUtils.addRandomDelay(200)
      
      const response = NextResponse.json(
        { success: false, error: validation.error },
        { status: 400 }
      )
      return addSecurityHeaders(response)
    }

    const { password, userId } = validation.data!

    // Additional strength check following PromptOK patterns
    const passwordRegex = /^(?=.*[0-9])(?=.*[!@#$%^&*])/
    if (!passwordRegex.test(password)) {
      await SecureAuthUtils.addRandomDelay(200)
      
      const response = NextResponse.json(
        { success: false, error: 'Password must contain at least one number and one special character' },
        { status: 400 }
      )
      return addSecurityHeaders(response)
    }

    const supabase = await createClient()
    const clientIP = getClientIP(request)
    const userAgent = request.headers.get('user-agent') || ''

    // Get current session to verify user
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    
    if (sessionError || !session) {
      const response = NextResponse.json(
        { success: false, error: 'Invalid session. Please request a new password reset.' },
        { status: 401 }
      )
      return addSecurityHeaders(response)
    }

    // Verify the userId matches the session user
    if (session.user.id !== userId) {
      const response = NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 403 }
      )
      return addSecurityHeaders(response)
    }

    // Check if user is Google OAuth user
    const isGoogleOAuthUser = session.user.identities?.some(
      identity => identity.provider === 'google'
    ) || false

    // Use updateUser() for both OAuth and email users - it works for both
    const { error: updateError } = await supabase.auth.updateUser({
      password: password,
    })

    if (updateError) {
      console.error('Password update error:', updateError)
      const response = NextResponse.json(
        { success: false, error: updateError.message },
        { status: 400 }
      )
      return addSecurityHeaders(response)
    }

    // Log password update for audit
    const admin = await createClient()
    await admin.from('audit_logs').insert({
      user_id: session.user.id,
      action: 'password_update',
      entity_type: 'user_profile',
      entity_id: session.user.id,
      details: {
        user_agent: userAgent,
        is_google_oauth: isGoogleOAuthUser,
        method: 'password_reset'
      },
      performed_at: new Date().toISOString(),
      ip_address: clientIP
    })

    const response = NextResponse.json({
      success: true,
      message: isGoogleOAuthUser 
        ? 'Password set successfully! You can now sign in with either Google or your new password.'
        : 'Password updated successfully!',
      data: { isGoogleOAuthUser }
    })

    return addSecurityHeaders(response)

  } catch (error) {
    console.error('Set password error:', error)
    
    // Add random delay for server errors to prevent timing analysis
    await SecureAuthUtils.addRandomDelay(300)
    
    const response = NextResponse.json(
      { success: false, error: 'Failed to update password' },
      { status: 500 }
    )
    return addSecurityHeaders(response)
  }
}
