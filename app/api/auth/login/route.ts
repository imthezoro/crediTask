import { NextRequest, NextResponse } from 'next/server'
import { securityMiddleware, addSecurityHeaders, rateLimiter, getClientIP } from '@/lib/security-middleware'
import { loginSchema, validateRequest } from '@/lib/validation'
import { SecurityUtils } from '@/lib/security-utils'
import { SecureAuthUtils } from '@/lib/secure-auth-utils'

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
      // Add delay even for validation errors to prevent timing analysis
      await SecureAuthUtils.addRandomDelay(200)
      
      const response = NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      )
      return addSecurityHeaders(response)
    }

    const { email, password } = validation.data!
    const clientIP = getClientIP(request)
    const userAgent = request.headers.get('user-agent') || ''

    // Use secure authentication with constant-time response
    const authResult = await SecureAuthUtils.authenticateUser(email, password)

    // Log authentication attempt (success or failure)
    await SecureAuthUtils.logAuthAttempt(
      email,
      authResult.success,
      clientIP,
      userAgent,
      authResult.user?.id
    )

    if (authResult.success && authResult.user) {
      // Record successful login for rate limiting
      const identifier = await SecurityUtils.generateRateLimitKey(clientIP, userAgent, 'login')
      rateLimiter.recordSuccess(identifier, 'login', 'auth')

      const response = NextResponse.json({
        success: true,
        message: 'Login successful',
        user: authResult.user
      })

      return addSecurityHeaders(response)
    } else {
      // Always return the same error message regardless of failure reason
      const response = NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      )
      return addSecurityHeaders(response)
    }

  } catch (error) {
    console.error('Login API error:', error)
    
    // Add random delay even for server errors to prevent timing analysis
    await SecureAuthUtils.addRandomDelay(300)
    
    const response = NextResponse.json(
      { error: 'Invalid email or password' },
      { status: 401 }
    )
    return addSecurityHeaders(response)
  }
}
