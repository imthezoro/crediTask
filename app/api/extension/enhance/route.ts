import { NextRequest } from 'next/server';
import { verifyExtensionJWT, ExtensionJWTPayload } from '../../../../lib/jwt-utils';
import { 
  validateRequest,
  sanitizeString,
} from '@/lib/validation';
import { z } from 'zod';
import { rateLimiter, getClientIP } from '@/lib/rate-limiter';
import { createCorsResponse, corsEmpty } from '@/lib/cors';
import { createAdminClient } from '@/lib/supabase-server';

// Define a safe type for errors returned by the edge function
type EdgeFunctionError = {
  message?: string;
  error?: string;
  provider?: string;
  provider_status?: number | string;
  provider_status_text?: string;
  provider_response?: unknown;
};

// Handle preflight OPTIONS requests
export async function OPTIONS(request: NextRequest) {
  return corsEmpty(200, request);
}

export async function POST(request: NextRequest) {
  try {
    // Apply rate limiting
    const clientIP = getClientIP(request);
    const rateLimitKey = `extension-enhance:${clientIP}`;
    
    const rateLimitResult = await rateLimiter.check(clientIP, rateLimitKey, 'enhancePrompt');
    
    if (!rateLimitResult.allowed) {
      return createCorsResponse(
        { error: 'Too many requests. Please try again in few seconds.' },
        429,
        request
      );
    }

    // Extract and validate token from Authorization or x-extension-token
    const authHeader = request.headers.get('authorization');
    const extHeader = request.headers.get('x-extension-token');
    const token = authHeader && authHeader.startsWith('Bearer ')
      ? authHeader.substring(7)
      : (extHeader || '');
    if (!token) {
      return createCorsResponse(
        { error: 'UNAUTHORIZED', message: 'Extension token required' },
        401,
        request
      );
    }

    // Verify JWT token
    
    let payload: ExtensionJWTPayload;
    try {
      payload = await verifyExtensionJWT(token);
    } catch (jwtError) {
      console.error('[extension/enhance] JWT verification failed:', jwtError);
      return createCorsResponse(
        { error: 'UNAUTHORIZED', message: 'Invalid or expired token' },
        401,
        request
      );
    }

    // Validate scope contains 'enhance'
    if (!payload.scope || !payload.scope.includes('enhance')) {
      console.error('[extension/enhance] Insufficient scope:', payload.scope);
      return createCorsResponse(
        { error: 'FORBIDDEN', message: 'Insufficient permissions for enhancement' },
        403,
        request
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const validation = validateRequest(
      z.object({
        prompt: z.string().min(1).max(10000),
        site: z.string().min(1).max(64).optional(),
        chatUrl: z.string().min(1).max(2048).optional(),
      }),
      body
    );

    if (!validation.success) {
      return createCorsResponse(
        { error: 'INVALID_INPUT', message: validation.error },
        400,
        request
      );
    }

    const { prompt, site, chatUrl } = validation.data!;
    const sanitizedPrompt = sanitizeString(prompt);

    // Validate environment configuration
    const openrouterApiKey = process.env.OPENROUTER_API_KEY;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!openrouterApiKey || !serviceRoleKey) {
      console.error('[extension/enhance] Missing required envs', {
        hasOpenrouterKey: !!openrouterApiKey,
        hasServiceRoleKey: !!serviceRoleKey,
      });
      return createCorsResponse(
        { error: 'CONFIGURATION_ERROR', message: 'Service configuration error' },
        500,
        request
      );
    }
    
    // Check if LLM_MOCK is enabled for testing
    const llmMock = process.env.LLM_MOCK === 'true';
    
    if (llmMock) {
      // Return mock response for testing
      const mockEnhancedText = `Refined Prompt\n\nPlease improve the following prompt to be clear, specific, and ready to run. Keep the original intent.\n\nOriginal:\n"""\n${sanitizedPrompt}\n"""\n\nReturn the final improved prompt only.`;

      const mockStructured = {
        enhanced_prompt: `Improve the prompt for clarity and specificity.\n\nOriginal:\n"""\n${sanitizedPrompt}\n"""\n\nReturn a single finalized prompt line.`,
        display_excerpt: 'Mock: simple refinement with minimal options.',
        assumption_groups: [
          {
            group_id: 'S1',
            title: 'Tone',
            description: 'Select a tone',
            input_type: 'radio',
            options: [
              { option_id: 'S1_O1', label: 'Professional', short: 'Neutral, business-like', append_snippet: 'Use a professional, neutral tone.' },
              { option_id: 'S1_O2', label: 'Friendly', short: 'Approachable', append_snippet: 'Use a friendly, approachable tone.' }
            ]
          },
          {
            group_id: 'S2',
            title: 'Format',
            description: 'Choose output style',
            input_type: 'radio',
            options: [
              { option_id: 'S2_O1', label: 'Bullets', short: 'Headings + bullets', append_snippet: 'Structure with brief headings and bullet points.' },
              { option_id: 'S2_O2', label: 'Single paragraph', short: 'Compact text', append_snippet: 'Provide a single concise paragraph.' }
            ]
          }
        ],
        combination_snippets: []
      };

      return createCorsResponse({
        success: true,
        enhancedPrompt: mockEnhancedText.trim(),
        structuredData: mockStructured,
        mock: true,
        note: 'Mock response returned (LLM_MOCK=true)'
      }, 200, request);
    }

    // From here, inline the previous Edge Function logic
    const admin = createAdminClient();

    // Prepare labels and timing
    const siteLabel = (typeof site === 'string' && site.trim().length > 0) ? site.trim() : 'unknown';
    const chatUrlLabel = (typeof chatUrl === 'string' && chatUrl.trim().length > 0) ? chatUrl.trim().slice(0, 2048) : null;
    const t0 = Date.now();
    let sessionId: string | null = null;

    // Fetch user profile for plan/usage
    const userId = payload.userId;
    const { data: userProfile, error: profileError } = await admin
      .from('user_profiles')
      .select('plan, usage_count, plan_valid_until, prompt_limit')
      .eq('id', userId)
      .single();

    if (profileError) {
      console.error('[extension/enhance] Error fetching user profile:', profileError);
      return createCorsResponse(
        { error: 'Failed to verify user plan' },
        500,
        request
      );
    }

    if (!userProfile) {
      return createCorsResponse(
        { error: 'User profile not found' },
        404,
        request
      );
    }

    // Enforce prompt_limit like edge function
    const limit: number | null = (userProfile as { prompt_limit?: number | null })?.prompt_limit ?? null;
    const overLimit = typeof limit === 'number' && userProfile.usage_count >= limit;
    if (overLimit) {
      return createCorsResponse(
        {
          error: 'Usage limit reached. Please upgrade your plan.',
          usage: userProfile.usage_count,
          limit: limit ?? undefined,
        },
        403,
        request
      );
    }

    // Create pending prompt session (best effort)
    try {
      const { data: pendingRows } = await admin
        .from('prompt_sessions')
        .insert({
          user_id: userId,
          original_prompt: sanitizedPrompt,
          site: siteLabel,
          chat_url: chatUrlLabel,
          status: 'pending',
          response_time_ms: 0,
        })
        .select('id');
      if (pendingRows && Array.isArray(pendingRows) && pendingRows.length > 0) {
        // @ts-ignore
        sessionId = pendingRows[0]?.id ?? null;
      }
    } catch (e) {
      console.warn('[extension/enhance] Could not insert pending session', e);
    }

    // System prompt copied from Edge Function for parity
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

Now, when you are given the user prompt, do the above.`;

    // Call OpenRouter API
    const openrouterResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openrouterApiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://promptok.app',
        'X-Title': 'PromptOK',
      },
      body: JSON.stringify({
        model: 'nvidia/nemotron-nano-9b-v2:free',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: sanitizedPrompt },
        ],
        max_tokens: 3500,
        temperature: 0.2,
      }),
    });

    if (!openrouterResponse.ok) {
      const errorData = await openrouterResponse.json().catch(() => ({}));
      console.error('[extension/enhance] OpenRouter API error:', errorData);
      // Mark session failed (best effort)
      try {
        if (sessionId) {
          const responseTime = Math.max(0, Date.now() - t0);
          await admin
            .from('prompt_sessions')
            .update({ status: 'failed', response_time_ms: responseTime, chat_url: chatUrlLabel })
            .eq('id', sessionId);
        }
      } catch {}
      return createCorsResponse(
        {
          error: 'ENHANCEMENT_FAILED',
          message: errorData.message || errorData.error || 'Enhancement service unavailable',
          provider: errorData.provider,
          provider_status: errorData.provider_status,
          provider_status_text: errorData.provider_status_text,
          provider_response: errorData.provider_response,
        },
        openrouterResponse.status,
        request
      );
    }

    // Success path: parse and finalize
    const openrouterData = await openrouterResponse.json();
    const enhancedText: string | undefined = openrouterData.choices?.[0]?.message?.content;

    if (!enhancedText) {
      try {
        if (sessionId) {
          const responseTime = Math.max(0, Date.now() - t0);
          await admin
            .from('prompt_sessions')
            .update({ status: 'failed', response_time_ms: responseTime })
            .eq('id', sessionId);
        }
      } catch {}
      return createCorsResponse(
        { error: 'Invalid response from OpenRouter API' },
        500,
        request
      );
    }

    // Try to parse fenced JSON from the model output
    let structuredResponse: unknown = null;
    try {
      const jsonMatch = (enhancedText as string).match(/```json\s*([\s\S]*?)```/i);
      if (jsonMatch) {
        structuredResponse = JSON.parse(jsonMatch[1].trim());
      }
    } catch {
      console.log('[extension/enhance] Could not parse structured response, using simple format');
    }

    // Atomically increment usage via RPC
    const { data: incData, error: rpcError } = await admin
      .rpc('increment_usage_if_allowed', { p_user_id: userId, p_increment: 1 });
    if (rpcError) {
      console.error('[extension/enhance] Error in increment_usage_if_allowed RPC:', rpcError);
      // continue; respect incRow.allowed if present
    }
    const incRow = Array.isArray(incData) ? (incData as any)[0] : null;
    if (incRow && incRow.allowed === false) {
      try {
        if (sessionId) {
          const responseTime = Math.max(0, Date.now() - t0);
          await admin
            .from('prompt_sessions')
            .update({ status: 'failed', response_time_ms: responseTime })
            .eq('id', sessionId);
        }
      } catch {}
      return createCorsResponse(
        {
          error: 'Usage limit reached. Please upgrade your plan.',
          usage: incRow.new_usage ?? userProfile.usage_count,
          limit: incRow.quota,
        },
        403,
        request
      );
    }

    // Mark session completed
    const totalResponseTime = Math.max(0, Date.now() - t0);
    try {
      if (sessionId) {
        await admin
          .from('prompt_sessions')
          .update({
            base_enhanced_prompt: (enhancedText as string).trim(),
            status: 'completed',
            response_time_ms: totalResponseTime,
          })
          .eq('id', sessionId);
      }
    } catch (e) {
      console.warn('[extension/enhance] Could not update completed session', e);
    }

    return createCorsResponse({
      success: true,
      enhancedPrompt: (enhancedText as string).trim(),
      structuredData: structuredResponse,
      usageCount: (incRow && typeof incRow.new_usage === 'number')
        ? incRow.new_usage
        : (userProfile.usage_count + 1),
      sessionId,
      responseTimeMs: totalResponseTime,
      site: siteLabel,
      chatUrl: chatUrlLabel,
    }, 200, request);

  } catch (error) {
    console.error('[extension/enhance] Unexpected error:', error);
    return createCorsResponse(
      { error: 'INTERNAL_ERROR', message: 'Enhancement service temporarily unavailable' },
      500,
      request
    );
  }
}
export async function GET() {
  return createCorsResponse(
    { error: 'METHOD_NOT_ALLOWED', message: 'Only POST requests are supported' },
    405
  );
}

export async function PUT() {
  return createCorsResponse(
    { error: 'METHOD_NOT_ALLOWED', message: 'Only POST requests are supported' },
    405
  );
}

export async function DELETE() {
  return createCorsResponse(
    { error: 'METHOD_NOT_ALLOWED', message: 'Only POST requests are supported' },
    405
  );
}
