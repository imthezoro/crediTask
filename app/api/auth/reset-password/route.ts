import { NextRequest, NextResponse } from 'next/server'
import { securityMiddleware, addSecurityHeaders } from '@/lib/security'
import { SecureAuthUtils } from '@/lib/secure-auth-utils'
import { createClient } from '@/lib/supabase/server'
import { resetPasswordSchema, validateRequest } from '@/lib/validation'

export async function POST(request: NextRequest) {
  // Apply security middleware with enhanced rate limiting for password reset
  const securityCheck = await securityMiddleware(request, 'reset-password', {
    requireOriginValidation: true,
    rateLimitType: 'auth-sensitive'
  })
  
  if (!securityCheck.allowed) {
    return addSecurityHeaders(securityCheck.response!)
  }

  try {
    const body = await request.json()
    
    // Validate request body
    const validation = validateRequest(resetPasswordSchema, body)
    if (!validation.success) {
      // Add delay even for validation errors to prevent timing analysis
      await SecureAuthUtils.addRandomDelay(200)
      
      const response = NextResponse.json(
        { 
          success: true, 
          message: 'If an account is associated with that email, a reset link has been sent'
        },
        { status: 200 }
      )
      return addSecurityHeaders(response)
    }

    const { email } = validation.data!

    // Use secure email check with constant-time response
    const emailCheck = await SecureAuthUtils.checkEmailExists(email)
    
    // Only send reset email if account actually exists (but don't reveal this)
    if (emailCheck.exists) {
      const supabase = await createClient()
      
      try {
        const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${siteUrl}/auth/reset-password-confirm`
        })
        
        if (error) {
          console.error('Password reset email error:', error)
        }
      } catch (error) {
        console.error('Password reset email error:', error)
        // Don't reveal email sending failures
      }
    }

    // Always return the same success message
    const response = NextResponse.json({
      success: true,
      message: emailCheck.message
    })

    return addSecurityHeaders(response)

  } catch (error) {
    console.error('Password reset error:', error)
    
    // Add delay for server errors too
    await SecureAuthUtils.addRandomDelay(300)
    
    const response = NextResponse.json(
      { 
        success: true, 
        message: 'If an account is associated with that email, a reset link has been sent'
      },
      { status: 200 }
    )
    return addSecurityHeaders(response)
  }
}
