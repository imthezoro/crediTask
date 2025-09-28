import { NextRequest } from 'next/server'
import { z } from 'zod'
import { verifyExtensionJWT } from '@/lib/jwt-utils'
import { createAdminClient } from '@/lib/supabase-server'
import { createCorsResponse, corsEmpty } from '@/lib/cors'
import { sanitizeString } from '@/lib/validation'

const BodySchema = z.object({
  sessionId: z.string().uuid(),
  finalPrompt: z.string().min(1).max(20000),
  status: z.enum(['completed', 'failed', 'pending']).optional(),
})

export async function OPTIONS(request: NextRequest) {
  return corsEmpty(200, request)
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return createCorsResponse({ error: 'UNAUTHORIZED', message: 'Bearer token required' }, 401, request)
    }

    const token = authHeader.substring(7)
    let payload
    try {
      payload = await verifyExtensionJWT(token)
    } catch {
      return createCorsResponse({ error: 'UNAUTHORIZED', message: 'Invalid or expired token' }, 401, request)
    }

    const bodyJson = await request.json().catch(() => null)
    const parsed = BodySchema.safeParse(bodyJson)
    if (!parsed.success) {
      return createCorsResponse({ error: 'INVALID_INPUT', message: 'Invalid finalize payload' }, 400, request)
    }

    const { sessionId, finalPrompt } = parsed.data
    const status = parsed.data.status || 'completed'

    const admin = createAdminClient()
    const sanitized = sanitizeString(finalPrompt)

    const { error, data } = await admin
      .from('prompt_sessions')
      .update({ final_prompt: sanitized, status })
      .eq('id', sessionId)
      .eq('user_id', payload.userId)
      .select('id')

    if (error) {
      console.error('[extension/session/finalize] Update failed:', error)
      return createCorsResponse({ error: 'UPDATE_FAILED', message: 'Could not update session' }, 500, request)
    }
    if (!data || data.length === 0) {
      return createCorsResponse({ error: 'NOT_FOUND', message: 'Session not found' }, 404, request)
    }

    return createCorsResponse({ success: true }, 200, request)
  } catch (err) {
    console.error('[extension/session/finalize] Unexpected error:', err)
    return createCorsResponse({ error: 'INTERNAL_ERROR', message: 'Unexpected error' }, 500, request)
  }
}
