import { createClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'
import { rateLimiter, securityLogger } from '@/lib/security-middleware'
import { addSecurityHeaders } from '@/lib/security-middleware'

// Use edge runtime for global performance
export const runtime = 'edge'

// Cache security status briefly for performance
export const revalidate = 60

// Security monitoring endpoint for admins
export async function GET() {
  try {
    // Get rate limiter stats
    const rateLimitStats = rateLimiter.getStats()
    
    // Get security logger stats with TTL info
    const loggerStats = securityLogger.getStats()
    const suspiciousActivity = securityLogger.getSuspiciousActivity(24)
    
    const response = new NextResponse(JSON.stringify({
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
    }), {
      headers: {
        'Content-Type': 'application/json',
        // Edge cache for 1 minute, allow 5 minutes stale while revalidating
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
      },
    })
    
    return addSecurityHeaders(response)
    
  } catch (error) {
    console.error('Security status API error:', error)
    const response = new NextResponse(JSON.stringify(
      { error: 'Internal server error' }
    ), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        // Don't cache error responses
        'Cache-Control': 'no-cache',
      },
    })
    return addSecurityHeaders(response)
  }
}
