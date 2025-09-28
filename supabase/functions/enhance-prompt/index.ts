// @ts-ignore - Deno remote imports are resolved at runtime
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
// @ts-ignore - Deno remote imports are resolved at runtime
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
// @ts-ignore - Deno remote imports are resolved at runtime
import { jwtVerify } from 'https://esm.sh/jose@5.2.0'
// Declare Deno for IDE type checking
// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const Deno: any;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Extension JWT verification function
async function verifyExtensionJWT(token: string) {
  try {
    console.log('[Edge Function] Starting JWT verification')
    console.log('[Edge Function] Token length:', token.length)
    console.log('[Edge Function] Token starts with:', token.substring(0, 20) + '...')
    
    const secretEnv = Deno.env.get('EXTENSION_JWT_SECRET')
    if (!secretEnv) {
      throw new Error('EXTENSION_JWT_SECRET not configured')
    }

    const secret = new TextEncoder().encode(secretEnv)
    console.log('[Edge Function] Encoded secret length:', secret.length)

    console.log('[Edge Function] Attempting jwtVerify...')
    const { payload } = await jwtVerify(token, secret)
    
    // Validate payload structure 
    if (!payload.userId || !Array.isArray(payload.scope)) {
      console.error('[Edge Function] Invalid payload structure:', { userId: !!payload.userId, scope: Array.isArray(payload.scope) })
      throw new Error('Invalid JWT payload structure')
    }

    // Validate issuer and audience
    const normalize = (url?: string) => (url ? url.replace(/\/+$/, '') : url)
    const allowedIssuers = [
      'http://localhost:3000',
      'http://127.0.0.1:3000',
      'https://prompt-ok.vercel.app'
    ].map(normalize)
    
    // Add custom site URL if set
    const customSiteUrl = normalize(Deno.env.get('NEXT_PUBLIC_SITE_URL') || undefined)
    if (customSiteUrl && !allowedIssuers.includes(customSiteUrl)) {
      allowedIssuers.push(customSiteUrl)
    }
    
    const payloadIss = normalize(payload.iss as string)
    if (!payloadIss || !allowedIssuers.includes(payloadIss)) {
      throw new Error(`Invalid issuer: expected one of [${allowedIssuers.join(', ')}], got ${payload.iss}`)
    }

    console.log('[Edge Function] Checking audience:', payload.aud)
    if (payload.aud !== 'promptok-extension') {
      throw new Error(`Invalid audience: expected promptok-extension, got ${payload.aud}`)
    }
    
    console.log('[Edge Function] JWT validation completed successfully')
    return payload
  } catch (error) {
    console.error('[Edge Function] JWT verification failed:', error)
    console.error('[Edge Function] Error type:', error.constructor.name)
    console.error('[Edge Function] Error message:', error.message)
    throw new Error('Invalid or expired JWT token')
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Extract Extension JWT token
    // Prefer custom header to avoid conflicts with Supabase gateway expectations
    const customHeader = req.headers.get('x-extension-token')
    const authHeader = req.headers.get('authorization')
    let token = customHeader || (authHeader && authHeader.startsWith('Bearer ') ? authHeader.substring(7) : '')
    if (!token) {
      return new Response(
        JSON.stringify({ error: 'Extension token required' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // Verify Extension JWT token
    let jwtPayload
    try {
      jwtPayload = await verifyExtensionJWT(token)
    } catch (jwtError) {
      return new Response(
        JSON.stringify({ error: 'Invalid or expired token' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // Validate scope contains 'enhance'
    if (!jwtPayload.scope || !jwtPayload.scope.includes('enhance')) {
      console.log('[Edge Function] Insufficient scope:', jwtPayload.scope)
      return new Response(
        JSON.stringify({ error: 'Insufficient permissions for enhancement' }),
        {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    const userId = jwtPayload.userId as string

    // Initialize Supabase client with service role for user profile access
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Parse request body
    const { prompt, site, chatUrl } = await req.json()

    if (!prompt) {
      return new Response(
        JSON.stringify({ error: 'Missing prompt' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // Check user's plan and usage based on your schema
    const { data: userProfile, error: profileError } = await supabaseClient
      .from('user_profiles')
      .select('plan, usage_count, plan_valid_until, prompt_limit')
      .eq('id', userId)
      .single()

    if (profileError) {
      console.error('Error fetching user profile:', profileError)
      return new Response(
        JSON.stringify({ error: 'Failed to verify user plan' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // Check if user has valid plan (implement your business logic here)
    if (!userProfile) {
      return new Response(
        JSON.stringify({ error: 'User profile not found' }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // Plan validation - use prompt_limit column as source of truth
    const limit: number | null = (userProfile as { prompt_limit?: number | null })?.prompt_limit ?? null
    const overLimit = typeof limit === 'number' && userProfile.usage_count >= limit

    if (overLimit) {
      return new Response(
        JSON.stringify({ 
          error: 'Usage limit reached. Please upgrade your plan.',
          usage: userProfile.usage_count,
          limit: limit
        }),
        {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // Prepare session bookkeeping
    const siteLabel = (typeof site === 'string' && site.trim().length > 0) ? site.trim() : 'unknown'
    const chatUrlLabel = (typeof chatUrl === 'string' && chatUrl.trim().length > 0) ? chatUrl.trim().slice(0, 2048) : null
    let sessionId: string | null = null

    // Create a pending prompt session before LLM call to track lifecycle
    try {
      const { data: pendingRows } = await supabaseClient
        .from('prompt_sessions')
        .insert({
          user_id: userId,
          original_prompt: prompt,
          site: siteLabel,
          chat_url: chatUrlLabel,
          status: 'pending',
          response_time_ms: 0,
        })
        .select('id')
      if (pendingRows && Array.isArray(pendingRows) && pendingRows.length > 0) {
        // @ts-ignore
        sessionId = pendingRows[0]?.id ?? null
      }
    } catch (e) {
      // Best-effort: continue without sessionId if RLS or other issue
      console.warn('[Edge Function] Could not insert pending session', e)
    }

    // Advanced system prompt for comprehensive enhancement
    const SYSTEM_PROMPT = `You are a Prompt-Enhancement Engine. When given an input user prompt (the "original prompt"), you must transform it into a high-quality, production-ready "enhanced prompt" and produce machine-readable output so a client UI can:

1. Present the top assumptions the LLM has to make to run the prompt, as *selectable options* (the user will choose among them).
2. Present additional configurable option groups (tone, audience, length, format, domain constraints, persona, output type, examples, constraints, locale/timeframe etc.) as choices the user can select.

CRITICAL: The "enhanced_prompt" field must be a complete, standalone prompt that works perfectly without any placeholders or brackets like [audience level], [specific aspects], etc. It should be immediately usable by any LLM.

The append_snippets are ONLY for adding extra context when options are selected. The base enhanced_prompt should never contain placeholder text.

Format your response as follows:

**Enhanced Prompt**
[Your enhanced version of the prompt - complete and usable without placeholders]

---

\`\`\`json
{
  "enhanced_prompt": "[Complete enhanced prompt with NO placeholders or brackets]",
  "display_excerpt": "[Brief 1-line summary]",
  "assumption_groups": [
    {
      "group_id": "A1",
      "title": "[Category Name]",
      "description": "[What this group helps clarify]",
      "input_type": "radio",
      "options": [
        {
          "option_id": "A1_O1",
          "label": "[Option Name]",
          "short": "[Brief description]",
          "append_snippet": "[Text to append to prompt if selected]"
        }
      ]
    }
  ],
  "combination_snippets": [
    {
      "combo": ["A1_O1", "A2_O1"],
      "append_snippet": "[Special text when these options are combined]"
    }
  ]
}
\`\`\`

Guidelines:
- The enhanced_prompt must be complete and functional without any placeholders
- Never use bracket notation like [audience level] or [specific aspects] in enhanced_prompt
- Make reasonable assumptions for the enhanced_prompt base version
- Provide 2-4 assumption groups with 2-4 options each
- append_snippets should add specific context when options are selected
- Set "input_type" to "radio" for mutually exclusive options or "checkbox" for multiple selections
- Use "radio" for categories like audience level, format type, or focus area where only one choice makes sense
- Use "checkbox" for features, topics, or elements that can be combined together
- Each append_snippet should be short (one or two sentences) and written so that simply appending it to the enhanced_prompt results in a clear, enforceable instruction for any downstream LLM.
- Only produce up to 6 option groups, and within each group up to 6 options. Prefer 3–5 options per useful group.
- Be conservative about making assumptions. If a critical missing detail would dramatically change the prompt, include a followup question and mark it as REQUIRED.
- Avoid hallucinations. When the original prompt references facts that are plausibly time-sensitive or ambiguous, do not invent specifics.

Behavior and tone:
- Produce safe, factual, and helpful guidance.
- When improving style, make minimal but high-impact edits. The enhanced prompt should remain faithful to the user's intent.
- When possible, normalize ambiguous units, formats and scopes.
- When producing append_snippets, use imperative, LLM-friendly phrasing. Keep it short.

Now, when you are given the user prompt, do the above.`

    // Call OpenRouter API
    const openrouterApiKey = Deno.env.get('OPENROUTER_API_KEY')
    if (!openrouterApiKey) {
      return new Response(
        JSON.stringify({ error: 'OpenRouter API key not configured' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // single timer for the whole enhancement flow
    const t0 = Date.now()

    const openrouterResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openrouterApiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://promptok.app',
        'X-Title': 'PromptOK'
      },
      body: JSON.stringify({
        model: 'nvidia/nemotron-nano-9b-v2:free',
        messages: [
          {
            role: 'system',
            content: SYSTEM_PROMPT
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 3500,
        temperature: 0.2
      })
    })

    if (!openrouterResponse.ok) {
      const errorData = await openrouterResponse.json().catch(() => ({}))
      console.error('OpenRouter API error:', errorData)
      // Mark session failed
      try {
        if (sessionId) {
          const responseTime = Math.max(0, Date.now() - t0)
          await supabaseClient
            .from('prompt_sessions')
            .update({ status: 'failed', response_time_ms: responseTime, chat_url: chatUrlLabel })
            .eq('id', sessionId)
        }
      } catch (_) {}
      return new Response(
        JSON.stringify({
          error: 'OPENROUTER_ERROR',
          message: 'Failed to enhance prompt via OpenRouter',
          provider: 'openrouter',
          provider_status: openrouterResponse.status,
          provider_status_text: openrouterResponse.statusText,
          provider_response: errorData
        }),
        {
          status: 502,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    const openrouterData = await openrouterResponse.json()
    const enhancedText = openrouterData.choices?.[0]?.message?.content

    if (!enhancedText) {
      try {
        if (sessionId) {
          const responseTime = Math.max(0, Date.now() - t0)
          await supabaseClient
            .from('prompt_sessions')
            .update({ status: 'failed', response_time_ms: responseTime })
            .eq('id', sessionId)
        }
      } catch (_) {}
      return new Response(
        JSON.stringify({ error: 'Invalid response from OpenRouter API' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // Try to parse the structured response
    let structuredResponse = null
    try {
      const jsonMatch = enhancedText.match(/```json\s*([\s\S]*?)```/i)
      if (jsonMatch) {
        structuredResponse = JSON.parse(jsonMatch[1].trim())
      }
    } catch (parseError) {
      console.log('Could not parse structured response, using simple format')
    }

    // Atomically increment usage with limit enforcement
    const { data: incData, error: rpcError } = await supabaseClient
      .rpc('increment_usage_if_allowed', { p_user_id: userId, p_increment: 1 })

    if (rpcError) {
      console.error('Error in increment_usage_if_allowed RPC:', rpcError)
      // Continue anyway but do not silently allow overuse; fall back to denying if we know we're at limit
    }

    const incRow = Array.isArray(incData) ? incData[0] : null
    if (incRow && incRow.allowed === false) {
      // Another concurrent tab likely consumed the last quota. Deny this request to keep limits correct.
      try {
        if (sessionId) {
          const responseTime = Math.max(0, Date.now() - t0)
          await supabaseClient
            .from('prompt_sessions')
            .update({ status: 'failed', response_time_ms: responseTime })
            .eq('id', sessionId)
        }
      } catch (_) {}
      return new Response(
        JSON.stringify({ 
          error: 'Usage limit reached. Please upgrade your plan.',
          usage: incRow.new_usage ?? userProfile.usage_count,
          limit: incRow.quota
        }),
        {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // Update session to completed with metrics and base prompt
    let totalResponseTime = Math.max(0, Date.now() - t0)
    try {
      if (sessionId) {
        await supabaseClient
          .from('prompt_sessions')
          .update({
            base_enhanced_prompt: enhancedText.trim(),
            status: 'completed',
            response_time_ms: totalResponseTime,
          })
          .eq('id', sessionId)
      }
    } catch (e) {
      console.warn('[Edge Function] Could not update completed session', e)
    }

    return new Response(
      JSON.stringify({ 
        enhancedPrompt: enhancedText.trim(),
        structuredData: structuredResponse,
        usageCount: (incRow && typeof incRow.new_usage === 'number')
          ? incRow.new_usage
          : (userProfile.usage_count + 1),
        sessionId,
        responseTimeMs: totalResponseTime,
        site: siteLabel,
        chatUrl: chatUrlLabel,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )

  } catch (error) {
    console.error('Edge function error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})
