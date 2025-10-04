import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { securityMiddleware, addSecurityHeaders } from '@/lib/security'
import { SecureAuthUtils } from '@/lib/secure-auth-utils'

interface PromptHistoryItem {
  id: string
  original: string
  enhanced: string
  timestamp: string
  llmPlatform: string
}

export async function GET(request: NextRequest) {
  const securityCheck = await securityMiddleware(request, 'prompt-history', {
    requireOriginValidation: false,
    rateLimitType: 'api'
  })
  
  if (!securityCheck.allowed) {
    return addSecurityHeaders(securityCheck.response!)
  }

  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      const response = NextResponse.json(
        { error: 'UNAUTHORIZED', message: 'Please sign in to view history' },
        { status: 401 }
      )
      return addSecurityHeaders(response)
    }

    // Validate user profile using secure utility (checks soft-delete, blocks, etc.)
    const profileValidation = await SecureAuthUtils.validateUserProfile(user.id)
    
    if (!profileValidation.isValid) {
      const response = NextResponse.json(
        { error: 'ACCOUNT_INACTIVE', message: profileValidation.error || 'Account is not active.' },
        { status: 403 }
      )
      return addSecurityHeaders(response)
    }

    // Fetch user's prompt history from prompt_sessions table
    const { data: sessions, error: sessionsError } = await supabase
      .from('prompt_sessions')
      .select('id, original_prompt, base_enhanced_prompt, site, created_at, status')
      .eq('user_id', user.id)
      .eq('status', 'completed')
      .order('created_at', { ascending: false })
      .limit(100)

    if (sessionsError) {
      console.error('[prompt-history] Error fetching sessions:', sessionsError)
      const response = NextResponse.json(
        { error: 'Failed to fetch history', message: sessionsError.message },
        { status: 500 }
      )
      return addSecurityHeaders(response)
    }

    // Map site names to sidebar platform IDs based on domain matching
    const mapSiteToPlatform = (site: string | null): string => {
      if (!site) return 'promptok'
      
      const siteLower = site.toLowerCase().trim()
      
      // Check for webapp (our own app) - must be exact match
      if (siteLower === 'webapp') return 'promptok'
      
      // Check for short site codes from extension
      if (siteLower === 'gpt') return 'chatgpt'
      
      // Check for domain patterns - order matters, check most specific first
      if (siteLower.includes('chatgpt') || siteLower.includes('openai') || siteLower.includes('chat.openai')) return 'chatgpt'
      if (siteLower.includes('claude') || siteLower.includes('anthropic')) return 'claude'
      if (siteLower.includes('gemini') || siteLower.includes('bard')) return 'gemini'
      if (siteLower.includes('perplexity')) return 'perplexity'
      if (siteLower.includes('copilot') || siteLower.includes('bing')) return 'copilot'
      
      // Default to promptok for unknown sites
      return 'promptok'
    }

    // Group by site/platform
    const groupedHistory: Record<string, PromptHistoryItem[]> = {}
    
    sessions?.forEach((session) => {
      const rawSite = session.site || 'webapp'
      // Map to sidebar platform ID using domain matching
      const platform = mapSiteToPlatform(rawSite)
      
      if (!groupedHistory[platform]) {
        groupedHistory[platform] = []
      }
      
      groupedHistory[platform].push({
        id: session.id,
        original: session.original_prompt || '',
        enhanced: session.base_enhanced_prompt || '',
        timestamp: session.created_at,
        llmPlatform: platform
      })
    })

    const response = NextResponse.json({
      success: true,
      history: groupedHistory,
      total: sessions?.length || 0
    }, { status: 200 })
    
    return addSecurityHeaders(response)

  } catch (error) {
    console.error('[prompt-history] Unexpected error:', error)
    const response = NextResponse.json(
      { error: 'INTERNAL_ERROR', message: 'Failed to fetch history' },
      { status: 500 }
    )
    return addSecurityHeaders(response)
  }
}
