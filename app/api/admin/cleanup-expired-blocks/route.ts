import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'
import { securityMiddleware, addSecurityHeaders, getClientIP } from '@/lib/security-middleware'
import { validateRequest } from '@/lib/validation'
import { z } from 'zod'

const cleanupSchema = z.object({
  dryRun: z.boolean().default(true)
})

export async function POST(request: NextRequest) {
  // Apply security middleware
  const securityCheck = await securityMiddleware(request, 'admin-cleanup', {
    requireOriginValidation: true,
    rateLimitType: 'api'
  })
  
  if (!securityCheck.allowed) {
    return addSecurityHeaders(securityCheck.response!)
  }

  try {
    const body = await request.json()
    
    // Validate request body
    const validation = validateRequest(cleanupSchema, body)
    if (!validation.success) {
      const response = NextResponse.json(
        { error: 'Invalid request data' },
        { status: 400 }
      )
      return addSecurityHeaders(response)
    }

    const { dryRun } = validation.data!
    const admin = createAdminClient()
    const clientIP = getClientIP(request)
    const userAgent = request.headers.get('user-agent') || ''

    // Find expired email blocks
    const { data: expiredBlocks, error: findError } = await admin
      .from('blocked_emails')
      .select('email, blocked_until, reason')
      .lt('blocked_until', new Date().toISOString())

    if (findError) {
      console.error('Failed to find expired blocks:', findError)
      const response = NextResponse.json(
        { error: 'Failed to query expired blocks' },
        { status: 500 }
      )
      return addSecurityHeaders(response)
    }

    const blocksFound = expiredBlocks?.length || 0
    let blocksDeleted = 0

    if (!dryRun && blocksFound > 0) {
      // Delete expired blocks
      const { error: deleteError } = await admin
        .from('blocked_emails')
        .delete()
        .lt('blocked_until', new Date().toISOString())

      if (deleteError) {
        console.error('Failed to delete expired blocks:', deleteError)
        const response = NextResponse.json(
          { error: 'Failed to delete expired blocks' },
          { status: 500 }
        )
        return addSecurityHeaders(response)
      }

      blocksDeleted = blocksFound

      // Log cleanup action
      await admin.from('audit_logs').insert({
        action: 'cleanup_expired_blocks',
        entity_type: 'blocked_emails',
        details: {
          blocks_deleted: blocksDeleted,
          performed_by: 'admin',
          ip_address: clientIP,
          user_agent: userAgent?.substring(0, 200)
        },
        ip_address: clientIP,
        performed_at: new Date().toISOString()
      })
    }

    const response = NextResponse.json({
      success: true,
      message: dryRun 
        ? `Found ${blocksFound} expired email blocks`
        : `Successfully deleted ${blocksDeleted} expired email blocks`,
      stats: {
        blocksFound,
        blocksDeleted,
        dryRun
      }
    })

    return addSecurityHeaders(response)

  } catch (error) {
    console.error('Cleanup expired blocks API error:', error)
    const response = NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
    return addSecurityHeaders(response)
  }
}
