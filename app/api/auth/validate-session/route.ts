import { NextRequest, NextResponse } from 'next/server'
import { SecureAuthUtils } from '@/lib/secure-auth-utils'
import { securityMiddleware, addSecurityHeaders } from '@/lib/security'
import { validateSessionSchema, validateRequest } from '@/lib/validation'

export async function POST(request: NextRequest) {
  // Apply security middleware
  const securityCheck = await securityMiddleware(request, 'validate-session', {
    requireOriginValidation: true,
    rateLimitType: 'api'
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
        { isValid: false, error: 'Account validation failed' },
        { status: 400 }
      )
      return addSecurityHeaders(response)
    }

    const { userId } = validation.data!

    // Use secure profile validation with constant-time response
    const validationResult = await SecureAuthUtils.validateUserProfile(userId)

    const response = NextResponse.json({
      isValid: validationResult.isValid,
      profile: validationResult.profile,
      error: validationResult.error,
      isBlocked: validationResult.isBlocked,
      blockedUntil: validationResult.blockedUntil
    })

    return addSecurityHeaders(response)

  } catch (error) {
    console.error('Session validation error:', error)
    
    // Add delay for server errors
    await SecureAuthUtils.addRandomDelay(200)
    
    const response = NextResponse.json(
      { isValid: false, error: 'Account validation failed' },
      { status: 500 }
    )
    return addSecurityHeaders(response)
  }
}
