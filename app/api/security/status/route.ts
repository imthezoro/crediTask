import { NextRequest, NextResponse } from 'next/server'
import { rateLimiter, securityLogger } from '@/lib/security-middleware'
import { addSecurityHeaders } from '@/lib/security-middleware'

// Security monitoring endpoint for admins
export async function GET(request: NextRequest) {
  try {
    // Get rate limiter stats
    const rateLimitStats = rateLimiter.getStats()
    
    // Get security logger stats with TTL info
    const loggerStats = securityLogger.getStats()
    const suspiciousActivity = securityLogger.getSuspiciousActivity(24)
    
    const response = NextResponse.json({
      success: true,
      data: {
        rateLimiter: rateLimitStats,
        securityLogs: {
          totalLogs: loggerStats.totalLogs,
          suspiciousLogs: loggerStats.suspiciousLogs,
          oldestLog: loggerStats.oldestLog,
          ttlHours: 2 // Current TTL setting
        },
        recentSuspiciousActivity: suspiciousActivity.length,
        suspiciousEvents: suspiciousActivity.slice(0, 10) // Latest 10 suspicious events
      }
    })
    
    return addSecurityHeaders(response)
    
  } catch (error) {
    console.error('Security status API error:', error)
    const response = NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
    return addSecurityHeaders(response)
  }
}
