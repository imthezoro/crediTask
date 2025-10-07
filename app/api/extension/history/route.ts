import { NextRequest } from 'next/server'
import { z } from 'zod'
import { createCorsResponse, corsEmpty } from '@/lib/cors'
import { verifyExtensionJWT } from '@/lib/jwt-utils'
import { createAdminClient } from '@/lib/supabase/server'

const QuerySchema = z.object({
  chatUrl: z.string().min(1).max(2048),
  limit: z.coerce.number().min(1).max(100).default(20),
})

export async function OPTIONS(request: NextRequest) {
  return corsEmpty(200, request)
}

export async function GET(request: NextRequest) {
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

    const url = new URL(request.url)
    const parsed = QuerySchema.safeParse({
      chatUrl: url.searchParams.get('chatUrl') || '',
      limit: url.searchParams.get('limit') || undefined,
    })
    if (!parsed.success) {
      return createCorsResponse({ error: 'INVALID_INPUT', message: 'chatUrl is required' }, 400, request)
    }

    const { chatUrl, limit } = parsed.data

    const admin = createAdminClient()
    const { data, error } = await admin
      .from('prompt_sessions')
      .select('id, created_at, site, status, response_time_ms, base_enhanced_prompt, final_prompt')
      .eq('user_id', payload.userId)
      .eq('chat_url', chatUrl)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) {
      console.error('[extension/history] Query failed:', error)
      return createCorsResponse({ error: 'QUERY_FAILED', message: 'Could not fetch history' }, 500, request)
    }

    return createCorsResponse({ success: true, items: data || [] }, 200, request)
  } catch (err) {
    console.error('[extension/history] Unexpected error:', err)
    return createCorsResponse({ error: 'INTERNAL_ERROR', message: 'Unexpected error' }, 500, request)
  }
}
