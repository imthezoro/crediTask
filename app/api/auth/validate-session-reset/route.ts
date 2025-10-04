import { NextRequest, NextResponse } from 'next/server'
import { securityMiddleware, addSecurityHeaders } from '@/lib/security'
import { SecureAuthUtils } from '@/lib/secure-auth-utils'
import { validateSessionSchema, validateRequest } from '@/lib/validation'
import { createClient, createAdminClient } from '@/lib/supabase-server'

/**
 * Special session validation endpoint for password reset flow
 * Bypasses normal profile validation to allow password reset completion
 */
export async function POST(request: NextRequest) {
  // Apply basic security middleware
  const securityCheck = await securityMiddleware(request, 'validate-session-reset', {
    requireOriginValidation: true,
    rateLimitType: 'auth'
  })
  
  if (!securityCheck.allowed) {
    return addSecurityHeaders(securityCheck.response!)
  }

  try {
    const body = await request.json()
    
    // Validate request body
    const validation = validateRequest(validateSessionSchema, body)
    if (!validation.success) {
      // Add delay for validation errors to prevent timing analysis
      await SecureAuthUtils.addRandomDelay(200)
      
      const response = NextResponse.json(
        { isValid: false, error: 'Invalid request format' },
        { status: 400 }
      )
      return addSecurityHeaders(response)
    }

    const { userId } = validation.data!

    const supabase = await createClient()
    const admin = createAdminClient()
    
    // For password reset, we only need to verify the auth session exists
    // We don't check profile status since user might be resetting after deactivation
    const { data: { user }, error } = await supabase.auth.getUser()

    if (error || !user || user.id !== userId) {
      const response = NextResponse.json(
        { isValid: false, error: 'Invalid session' },
        { status: 401 }
      )
      return addSecurityHeaders(response)
    }

    // Explicitly block reset if user's email is still blocked (soft-deleted period not expired)
    const email = user.email || null
    if (email) {
      const nowIso = new Date().toISOString()
      const { data: blocked } = await admin
        .from('blocked_emails')
        .select('blocked_until')
        .eq('email', email)
        .gt('blocked_until', nowIso)
        .maybeSingle()

      if (blocked?.blocked_until) {
        const response = NextResponse.json(
          {
            isValid: false,
            isBlocked: true,
            blockedUntil: blocked.blocked_until,
            error: 'Account is temporarily blocked'
          },
          { status: 403 }
        )
        return addSecurityHeaders(response)
      }
    }

    // Session is valid for password reset purposes
    const response = NextResponse.json({
      isValid: true,
      userId: user.id
    })

    return addSecurityHeaders(response)

  } catch (error) {
    console.error('Reset session validation error:', error)
    
    // Add delay for server errors
    await SecureAuthUtils.addRandomDelay(200)
    
    const response = NextResponse.json(
      { isValid: false, error: 'Validation failed' },
      { status: 500 }
    )
    return addSecurityHeaders(response)
  }
}
