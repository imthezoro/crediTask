import { NextRequest, NextResponse } from 'next/server'
import { rateLimiter, getClientIP } from '../cache/rate-limiter'
import { sanitizeString } from '../validation'
import { SecurityUtils } from './utils'

// Re-export for convenience
export { rateLimiter, getClientIP }

// CSRF Protection
export function validateOrigin(request: NextRequest): boolean {
  const origin = request.headers.get('origin')
  const host = request.headers.get('host')
  const referer = request.headers.get('referer')
  
  // Allow same-origin requests
  if (origin && host) {
    const originHost = new URL(origin).host
    if (originHost === host) {
      return true
    }
  }
  
  // Allow requests with valid referer
  if (referer && host) {
    try {
      const refererHost = new URL(referer).host
      if (refererHost === host) {
        return true
      }
    } catch {
      // Invalid referer URL
    }
  }
  
  // Allow GET requests without origin/referer (direct navigation)
  if (request.method === 'GET') {
    return true
  }
  
  return false
}

// Security headers
export function addSecurityHeaders(response: NextResponse): NextResponse {
  // Prevent XSS attacks
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('X-XSS-Protection', '1; mode=block')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  
  // Content Security Policy - Next.js compatible
  const isDev = process.env.NODE_ENV === 'development'
  
  const csp = [
    "default-src 'self'",
    isDev 
      ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'" // Allow for Next.js dev mode
      : "script-src 'self' 'unsafe-inline'", // Production: allow inline but not eval
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "font-src 'self' data:",
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co ws://localhost:* http://localhost:*", // Allow dev server
    "frame-ancestors 'none'",
    "object-src 'none'",
    "base-uri 'self'"
  ].join('; ')
  
  response.headers.set('Content-Security-Policy', csp)
  
  return response
}

// Rate limiting result interface for type safety
interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetTime: number
  blocked: boolean
  blockUntil?: number
}

// Rate limiting middleware
export async function applyRateLimit(
  request: NextRequest,
  endpoint: string,
  configType: 'auth' | 'auth-sensitive' | 'api' = 'api'
): Promise<{ allowed: boolean; response?: NextResponse }> {
  const clientIP = getClientIP(request)
  const userAgent = request.headers.get('user-agent') || 'unknown'
  
  // Create secure composite identifier using SecurityUtils
  const identifier = await SecurityUtils.generateRateLimitKey(clientIP, userAgent, endpoint)
  
  const result = rateLimiter.check(identifier, endpoint, configType)
  
  if (!result.allowed) {
    const response = NextResponse.json(
      {
        error: result.blocked 
          ? 'Too many requests. You have been temporarily blocked.'
          : 'Rate limit exceeded. Please try again later.',
        retryAfter: Math.ceil((result.resetTime - Date.now()) / 1000),
        blockedUntil: result.blockUntil ? new Date(result.blockUntil).toISOString() : undefined
      },
      { status: 429 }
    )
    
    // Add rate limit headers with correct limit from config
    const config = rateLimiter.getConfig(configType)
    response.headers.set('X-RateLimit-Limit', config?.maxRequests.toString() || '100')
    response.headers.set('X-RateLimit-Remaining', result.remaining.toString())
    response.headers.set('X-RateLimit-Reset', new Date(result.resetTime).toISOString())
    response.headers.set('Retry-After', Math.ceil((result.resetTime - Date.now()) / 1000).toString())
    
    return { allowed: false, response }
  }
  
  return { allowed: true }
}

// Request logging for security monitoring with TTL cleanup
interface SecurityLog {
  timestamp: string
  ip: string
  userAgent: string
  method: string
  url: string
  endpoint: string
  rateLimitStatus: string
  blocked: boolean
  suspicious: boolean
  expiresAt: number // TTL timestamp
}

class SecurityLogger {
  private logs: SecurityLog[] = []
  private readonly maxLogs = 500 // Reduced for MVP
  private readonly logTtlMs = 2 * 60 * 60 * 1000 // 2 hours TTL
  private cleanupInterval: NodeJS.Timeout | null = null
  
  constructor() {
    // Cleanup expired logs every 30 minutes
    this.startCleanup()
  }
  
  private startCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
    }
    this.cleanupInterval = setInterval(() => this.cleanup(), 30 * 60 * 1000)
  }
  
  private cleanup(): void {
    const now = Date.now()
    const initialCount = this.logs.length
    
    // Remove expired logs
    this.logs = this.logs.filter(log => log.expiresAt > now)
    
    const removedCount = initialCount - this.logs.length
    if (removedCount > 0) {
      console.log(`SecurityLogger: Cleaned up ${removedCount} expired logs`)
    }
  }
  
  public destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
      this.cleanupInterval = null
    }
    this.logs = []
  }
  
  log(request: NextRequest, endpoint: string, rateLimitResult: RateLimitResult, suspicious: boolean = false): void {
    const now = Date.now()
    const log: SecurityLog = {
      timestamp: new Date().toISOString(),
      ip: getClientIP(request),
      userAgent: sanitizeString(request.headers.get('user-agent') || 'unknown'),
      method: request.method,
      url: sanitizeString(request.url),
      endpoint: sanitizeString(endpoint),
      rateLimitStatus: rateLimitResult.allowed ? 'allowed' : 'blocked',
      blocked: rateLimitResult.blocked || false,
      suspicious,
      expiresAt: now + this.logTtlMs
    }
    
    this.logs.push(log)
    
    // Keep only recent logs (size-based cleanup)
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs)
    }
    
    // Log suspicious activity
    if (suspicious || rateLimitResult.blocked) {
      console.warn('Security Alert:', JSON.stringify(log, null, 2))
    }
  }
  
  getRecentLogs(limit: number = 100): SecurityLog[] {
    // Clean expired logs before returning
    this.cleanup()
    return this.logs.slice(-limit)
  }
  
  getSuspiciousActivity(hours: number = 24): SecurityLog[] {
    const cutoff = Date.now() - (hours * 60 * 60 * 1000)
    // Clean expired logs first
    this.cleanup()
    
    return this.logs.filter(log => 
      (log.suspicious || log.blocked) && 
      new Date(log.timestamp).getTime() > cutoff
    )
  }
  
  getStats(): { totalLogs: number; suspiciousLogs: number; oldestLog?: string } {
    this.cleanup()
    const suspiciousCount = this.logs.filter(log => log.suspicious || log.blocked).length
    const oldestLog = this.logs.length > 0 ? this.logs[0].timestamp : undefined
    
    return {
      totalLogs: this.logs.length,
      suspiciousLogs: suspiciousCount,
      oldestLog
    }
  }
}

export const securityLogger = new SecurityLogger()

// Enhanced suspicious activity detection using SecurityUtils
export function detectSuspiciousActivity(request: NextRequest): boolean {
  const userAgent = request.headers.get('user-agent') || ''
  const ip = getClientIP(request)
  const url = request.url
  // Parse URL to separate pathname from query to reduce false positives
  let queryString = ''
  try {
    const parsed = new URL(url)
    queryString = parsed.search || ''
  } catch {
    // If URL parsing fails, keep empty queryString
  }
  
  // Check for XSS patterns in URL or headers
  if (SecurityUtils.detectXss(url) || SecurityUtils.detectXss(userAgent)) {
    return true
  }
  
  // Check for SQL injection patterns only in the query string, not the path
  // This avoids false positives like the word "delete" in "/api/auth/delete-account"
  if (SecurityUtils.detectSqlInjection(queryString)) {
    return true
  }
  
  // Common bot patterns
  const suspiciousUserAgents = [
    /bot/i,
    /crawler/i,
    /spider/i,
    /scraper/i,
    /curl/i,
    /wget/i,
    /python/i,
    /^$/
  ]
  
  // Check for suspicious user agents
  if (suspiciousUserAgents.some(pattern => pattern.test(userAgent))) {
    return true
  }
  
  // Check for suspicious IPs (basic patterns)
  if (ip === 'unknown' || ip.startsWith('127.') || ip.startsWith('10.')) {
    return false // Local/unknown IPs are not necessarily suspicious
  }
  
  // Check for rapid requests from same IP
  const recentLogs = securityLogger.getRecentLogs(50)
  const recentFromSameIP = recentLogs.filter(log => 
    log.ip === ip && 
    Date.now() - new Date(log.timestamp).getTime() < 60000 // Last minute
  )
  
  if (recentFromSameIP.length > 20) {
    return true
  }
  
  return false
}

// Main security middleware function
export async function securityMiddleware(
  request: NextRequest,
  endpoint: string,
  options: {
    requireOriginValidation?: boolean
    rateLimitType?: 'auth' | 'auth-sensitive' | 'api'
    skipRateLimit?: boolean
  } = {}
): Promise<{ allowed: boolean; response?: NextResponse }> {
  const {
    requireOriginValidation = false,
    rateLimitType = 'api',
    skipRateLimit = false
  } = options
  
  // CSRF Protection
  if (requireOriginValidation && !validateOrigin(request)) {
    const response = NextResponse.json(
      { error: 'Invalid origin. CSRF protection triggered.' },
      { status: 403 }
    )
    return { allowed: false, response: addSecurityHeaders(response) }
  }
  
  // Rate limiting
  if (!skipRateLimit) {
    const rateLimitResult = await applyRateLimit(request, endpoint, rateLimitType)
    
    // Detect suspicious activity
    const suspicious = detectSuspiciousActivity(request)
    
    // Log the request with proper type handling
    const logData: RateLimitResult = {
      allowed: rateLimitResult.allowed,
      remaining: 0,
      resetTime: Date.now() + 60000,
      blocked: false
    }
    
    securityLogger.log(request, endpoint, logData, suspicious)
    
    if (!rateLimitResult.allowed) {
      return rateLimitResult
    }
    
    // Block suspicious activity
    if (suspicious) {
      const clientIP = getClientIP(request)
      const userAgent = request.headers.get('user-agent') || ''
      const identifier = await SecurityUtils.generateRateLimitKey(clientIP, userAgent, endpoint)
      
      // Block for 1 hour
      rateLimiter.block(identifier, endpoint, 60 * 60 * 1000)
      
      const response = NextResponse.json(
        { error: 'Suspicious activity detected. Access temporarily blocked.' },
        { status: 403 }
      )
      return { allowed: false, response: addSecurityHeaders(response) }
    }
  }
  
  return { allowed: true }
}
