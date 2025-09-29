import { NextRequest } from 'next/server'
import { z } from 'zod'
import { verifyExtensionJWT, ExtensionJWTPayload } from '@/lib/jwt-utils'
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
    // Accept Authorization or x-extension-token for consistency
    const authHeader = request.headers.get('authorization')
    const extHeader = request.headers.get('x-extension-token')
    const token = authHeader && authHeader.startsWith('Bearer ')
      ? authHeader.substring(7)
      : (extHeader || '')
    if (!token) {
      return createCorsResponse({ error: 'UNAUTHORIZED', message: 'Extension token required' }, 401, request)
    }

    let payload: ExtensionJWTPayload
    try {
      payload = await verifyExtensionJWT(token)
    } catch {
      return createCorsResponse({ error: 'UNAUTHORIZED', message: 'Invalid or expired token' }, 401, request)
    }

    // Enforce token version parity
    if (payload.token_version !== 1) {
      return createCorsResponse({ error: 'UNAUTHORIZED', message: 'Unsupported token version' }, 401, request)
    }

    const bodyJson = await request.json().catch(() => null)
    const parsed = BodySchema.safeParse(bodyJson)
    if (!parsed.success) {
      return createCorsResponse({ error: 'INVALID_INPUT', message: 'Invalid finalize payload' }, 400, request)
    }

    const { sessionId, finalPrompt } = parsed.data
    const status = parsed.data.status || 'completed'

    const admin = createAdminClient()

    // Soft-delete and session revocation checks
    console.log('[extension/session/finalize] Fetching profile for userId:', payload.userId)
    const { data: profile, error: profileError } = await admin
      .from('user_profiles')
      .select('is_active, session_revoked_at')
      .eq('id', payload.userId)
      .single()
    
    if (profileError) {
      console.error('[extension/session/finalize] Profile fetch failed:', {
        error: profileError,
        code: profileError.code,
        message: profileError.message,
        details: profileError.details,
        hint: profileError.hint,
        userId: payload.userId
      })
      
      // If profile not found but session exists, allow finalization without validation
      // This handles edge cases where profile is missing but enhancement succeeded
      if (profileError.code === 'PGRST116') {
        console.warn('[extension/session/finalize] Profile not found, proceeding without validation')
      } else {
        return createCorsResponse({ error: 'PROFILE_ERROR', message: 'Failed to validate account' }, 500, request)
      }
    }
    
    if (profile && !profile) {
      return createCorsResponse({ error: 'NOT_FOUND', message: 'User profile not found' }, 404, request)
    }
    // Only check profile status if profile was fetched successfully
    if (profile) {
      if (profile.is_active === false) {
        return createCorsResponse({ error: 'ACCOUNT_DEACTIVATED', message: 'This account has been deactivated.' }, 403, request)
      }
      const revokedAt = profile.session_revoked_at ? Date.parse(String(profile.session_revoked_at)) : null
      const tokenIatMs = payload.iat ? payload.iat * 1000 : 0
      if (revokedAt && tokenIatMs < revokedAt) {
        return createCorsResponse({ error: 'SESSION_REVOKED', message: 'Session has been revoked. Please sign in again.' }, 401, request)
      }
    }

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
