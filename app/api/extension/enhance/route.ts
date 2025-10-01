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
import { readFileSync } from 'fs';
import { join } from 'path';

// Define a type for the usage increment RPC response row
type UsageIncrementRow = {
  allowed?: boolean;
  new_usage?: number;
  quota?: number;
};

// Define types for the structured enhancement response
type SelectionPathItem = { question_id: string; option: string };
type Question = {
  id: string;
  text: string;
  options: string[];
  required: boolean;
  depends_on: SelectionPathItem[];
  meta?: Record<string, unknown>;
};
type SelectionUpdate = { selection_path: SelectionPathItem[]; base_prompt: string };
interface EnhancedStructuredResponse {
  base_prompt: string;
  questions: Question[];
  selection_updates: SelectionUpdate[];
  final_prompt?: string;
  change_log?: string[];
  security_warnings?: string[];
}

function isEnhancedStructuredResponse(x: unknown): x is EnhancedStructuredResponse {
  if (!x || typeof x !== 'object') return false;
  const obj = x as Record<string, unknown>;
  if (typeof obj.base_prompt !== 'string') return false;
  if (!Array.isArray(obj.questions)) return false;
  if (!Array.isArray(obj.selection_updates)) return false;
  return true;
}

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

    // Enforce token version for forward compatibility
    if (payload.token_version !== 1) {
      return createCorsResponse(
        { error: 'UNAUTHORIZED', message: 'Unsupported token version' },
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
        chatUrl: z.string().min(1).max(2048).nullable().optional(),
        metadata: z.object({
          target_model: z.string().optional(),
          user_settings: z.object({
            verbosity: z.enum(['concise', 'balanced', 'verbose']).optional(),
          }).optional(),
          user_advice: z.string().optional(),
        }).optional(),
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

    const { prompt, site, chatUrl, metadata } = validation.data!;
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
      // Sophisticated mock response for testing all features
      const mockStructured = {
        enhanced_prompt: `You are a professional content creator specializing in ${sanitizedPrompt}. Create comprehensive, well-structured content that:

1. **Analyzes the target audience** and adapts tone/complexity accordingly
2. **Follows the specified format** with appropriate structure
3. **Incorporates requested elements** (examples, case studies, visuals, etc.)
4. **Maintains proper length** as specified
5. **Addresses specific focus areas** selected by the user

Always begin with a compelling introduction and end with actionable takeaways.`,
        questions: [
          {
            id: 'Q1',
            text: 'What is your primary goal for this content?',
            type: 'radio',
            options: ['Educational', 'Marketing', 'Technical Documentation', 'Entertainment']
          },
          {
            id: 'Q2',
            text: 'Who is your target audience?',
            type: 'radio',
            options: ['Beginners', 'Intermediate', 'Advanced Professionals', 'General Public']
          },
          {
            id: 'Q3',
            text: 'What tone would you like?',
            type: 'radio',
            options: ['Professional', 'Casual/Friendly', 'Academic', 'Conversational'],
            trigger: {
              question_id: 'Q1',
              answer: 'Educational'
            }
          },
          {
            id: 'Q4',
            text: 'Which marketing channels will this content be used for?',
            type: 'checkbox',
            options: ['Social Media', 'Email Campaign', 'Website/Blog', 'Print Materials', 'Video Script'],
            trigger: {
              question_id: 'Q1',
              answer: 'Marketing'
            }
          },
          {
            id: 'Q5',
            text: 'What programming languages or technologies should be covered?',
            type: 'checkbox',
            options: ['JavaScript/TypeScript', 'Python', 'Java', 'C++', 'Go', 'Rust', 'SQL'],
            trigger: {
              question_id: 'Q1',
              answer: 'Technical Documentation'
            }
          },
          {
            id: 'Q6',
            text: 'Should code examples be included?',
            type: 'radio',
            options: ['Yes, with detailed explanations', 'Yes, brief snippets only', 'No, theory only'],
            trigger: {
              question_id: 'Q1',
              answer: 'Technical Documentation'
            }
          },
          {
            id: 'Q7',
            text: 'What is your desired content length?',
            type: 'radio',
            options: ['Short (300-500 words)', 'Medium (800-1200 words)', 'Long (2000+ words)', 'No preference']
          },
          {
            id: 'Q8',
            text: 'Which elements should be included?',
            type: 'checkbox',
            options: ['Real-world examples', 'Case studies', 'Statistics/data', 'Step-by-step tutorials', 'Visual descriptions', 'Comparison tables']
          },
          {
            id: 'Q9',
            text: 'What format would you like?',
            type: 'radio',
            options: ['Article/Essay', 'Listicle', 'How-to Guide', 'Q&A Format', 'Problem-Solution']
          },
          {
            id: 'Q10',
            text: 'Should the guide include beginner prerequisites?',
            type: 'radio',
            options: ['Yes, detailed prerequisites', 'Brief mention only', 'No, assume knowledge'],
            trigger: {
              question_id: 'Q2',
              answer: 'Advanced Professionals'
            }
          },
          {
            id: 'Q11',
            text: 'Which storytelling elements should be emphasized?',
            type: 'checkbox',
            options: ['Personal anecdotes', 'Humor', 'Emotional appeal', 'Plot-driven narrative', 'Character development'],
            trigger: {
              question_id: 'Q1',
              answer: 'Entertainment'
            }
          },
          {
            id: 'Q12',
            text: 'What call-to-action would you like?',
            type: 'radio',
            options: ['Purchase/Subscribe', 'Download resource', 'Contact us', 'Share content', 'No CTA'],
            trigger: {
              question_id: 'Q1',
              answer: 'Marketing'
            }
          }
        ]
      };

      return createCorsResponse({
        success: true,
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
    // Validate userId looks like a UUID to avoid PostgREST type errors
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(userId)) {
      console.error('[extension/enhance] Invalid userId format in token:', { userIdSample: String(userId).slice(0, 8) + '...' })
      return createCorsResponse(
        { error: 'UNAUTHORIZED', message: 'Invalid token subject' },
        401,
        request
      );
    }
    const { data: userProfile, error: profileError } = await admin
      .from('user_profiles')
      .select('usage_count, is_active')
      .eq('id', userId)
      .single();

    if (profileError) {
      console.error('[extension/enhance] Error fetching user profile:', profileError);
      const isProd = process.env.NODE_ENV === 'production';
      return createCorsResponse(
        {
          error: 'Failed to verify user plan',
          ...(isProd ? {} : { hint: 'profile_fetch_failed', details: String(profileError?.message || profileError) }),
        },
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

    // Soft-delete enforcement
    if (userProfile && userProfile.is_active === false) {
      return createCorsResponse(
        { error: 'ACCOUNT_DEACTIVATED', message: 'This account has been deactivated.' },
        403,
        request
      );
    }
    // Quota enforcement is delegated to RPC increment_usage_if_allowed below

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
        const first = (pendingRows as Array<{ id: string }>)[0];
        sessionId = first?.id ?? null;
      }
    } catch (e) {
      console.warn('[extension/enhance] Could not insert pending session', e);
    }

    // Read system prompt from SYSTEMPROMPT.md file
    let SYSTEM_PROMPT: string;
    try {
      const systemPromptPath = join(process.cwd(), 'SYSTEMPROMPT.md');
      SYSTEM_PROMPT = readFileSync(systemPromptPath, 'utf-8');
    } catch (error) {
      console.error('[extension/enhance] Failed to read SYSTEMPROMPT.md:', error);
      return createCorsResponse(
        { error: 'CONFIGURATION_ERROR', message: 'System prompt configuration error' },
        500,
        request
      );
    }

    // Prepare input for AI according to new schema
    const aiInput = {
      original_prompt: sanitizedPrompt,
      metadata: metadata || {}
    };

    console.log('[extension/enhance] DEBUG: Sending to AI:', {
      promptLength: sanitizedPrompt.length,
      hasMetadata: !!metadata,
      metadata: metadata
    });

    // Call OpenRouter API with retry logic (retry once on failure)
    // Note: Send as JSON string because system prompt expects JSON input format
    const requestBody = {
      model: 'nvidia/nemotron-nano-9b-v2:free',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: JSON.stringify(aiInput, null, 2) },
      ],
      max_tokens: 4000,
      temperature: 0.2,
    };

    console.log('[extension/enhance] DEBUG: OpenRouter request:', {
      model: requestBody.model,
      systemPromptLength: SYSTEM_PROMPT.length,
      userContentLength: requestBody.messages[1].content.length
    });

    let openrouterResponse: Response | null = null;
    let enhancedText: string | undefined;
    let structuredResponse: unknown = null;
    let parseMethod = 'none';
    let attemptCount = 0;
    const maxAttempts = 2; // Initial attempt + 1 retry

    // Retry loop for OpenRouter API call with JSON validation
    while (attemptCount < maxAttempts) {
      attemptCount++;
      console.log(`[extension/enhance] Attempt ${attemptCount}/${maxAttempts}`);

      openrouterResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openrouterApiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://promptok.app',
          'X-Title': 'PromptOK',
        },
        body: JSON.stringify(requestBody),
      });

      // Check if response is OK
      if (!openrouterResponse.ok) {
        if (attemptCount < maxAttempts) {
          console.log('[extension/enhance] API call failed, retrying in 500ms...');
          await new Promise(resolve => setTimeout(resolve, 500));
          continue;
        }
        break; // Exit loop on last attempt
      }

      // Parse response
      const openrouterData = await openrouterResponse.json();
      enhancedText = openrouterData.choices?.[0]?.message?.content;

      console.log('[extension/enhance] DEBUG: OpenRouter response:', {
        attempt: attemptCount,
        hasChoices: !!openrouterData.choices,
        choicesLength: openrouterData.choices?.length,
        hasContent: !!enhancedText,
        contentLength: enhancedText?.length,
        contentPreview: enhancedText?.substring(0, 200)
      });

      if (!enhancedText) {
        console.log('[extension/enhance] No content in response');
        if (attemptCount < maxAttempts) {
          console.log('[extension/enhance] Retrying in 500ms...');
          await new Promise(resolve => setTimeout(resolve, 500));
          continue;
        }
        break; // Exit loop on last attempt
      }

      // Try to parse JSON
      console.log('[extension/enhance] DEBUG: Starting JSON parse...');
      structuredResponse = null;
      
      try {
        // Try direct JSON parse first
        structuredResponse = JSON.parse(enhancedText as string);
        parseMethod = 'direct';
        console.log('[extension/enhance] DEBUG: Direct JSON parse successful');
      } catch (directError) {
        console.log('[extension/enhance] DEBUG: Direct parse failed:', (directError as Error).message);
        
        // Fallback: try to extract JSON from markdown code block
        try {
          const jsonMatch = (enhancedText as string).match(/```json\s*([\s\S]*?)```/i);
          if (jsonMatch) {
            console.log('[extension/enhance] DEBUG: Found JSON in code block, length:', jsonMatch[1].length);
            structuredResponse = JSON.parse(jsonMatch[1].trim());
            parseMethod = 'markdown';
            console.log('[extension/enhance] DEBUG: Markdown JSON parse successful');
          } else {
            console.log('[extension/enhance] DEBUG: No JSON code block found in response');
          }
        } catch (markdownError) {
          console.log('[extension/enhance] DEBUG: Markdown parse failed:', (markdownError as Error).message);
        }
      }

      // Validate schema structure
      if (isEnhancedStructuredResponse(structuredResponse)) {
        console.log('[extension/enhance] DEBUG: Schema validation passed!');
        break; // Success! Exit retry loop
      } else if (structuredResponse && typeof structuredResponse === 'object') {
        console.warn('[extension/enhance] Response missing required fields');
        console.log('[extension/enhance] DEBUG: structuredResponse keys:', Object.keys(structuredResponse as Record<string, unknown>));
      } else {
        console.log('[extension/enhance] DEBUG: structuredResponse is not an object:', typeof structuredResponse);
      }

      // If we get here and it's not the last attempt, retry
      if (attemptCount < maxAttempts) {
        console.log('[extension/enhance] Invalid JSON or schema, retrying in 500ms...');
        structuredResponse = null;
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    // Safety check: ensure response exists
    if (!openrouterResponse) {
      console.error('[extension/enhance] No response received from OpenRouter after retries');
      return createCorsResponse(
        { error: 'ENHANCEMENT_FAILED', message: 'Failed to get response from AI service' },
        500,
        request
      );
    }

    // Check final response status after retry loop
    if (!openrouterResponse.ok) {
      const errorData = await openrouterResponse.json().catch(() => ({}));
      console.error('[extension/enhance] OpenRouter API error after retries:', errorData);
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

    // Check if we got valid content after retries
    if (!enhancedText) {
      console.error('[extension/enhance] No valid content after retries');
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

    // Check if we got valid structured response after retries
    if (!isEnhancedStructuredResponse(structuredResponse)) {
      console.error('[extension/enhance] No valid structured response after retries');
      if (structuredResponse && typeof structuredResponse === 'object') {
        console.log('[extension/enhance] DEBUG: structuredResponse keys:', Object.keys(structuredResponse as Record<string, unknown>));
      }
      // Mark as invalid but don't fail completely - return raw response as fallback
      console.log('[extension/enhance] Returning raw response as fallback');
      structuredResponse = null;
    }

    // Atomically increment usage via RPC
    const { data: incData, error: rpcError } = await admin
      .rpc('increment_usage_if_allowed', { p_user_id: userId, p_increment: 1 });
    if (rpcError) {
      console.error('[extension/enhance] Error in increment_usage_if_allowed RPC:', rpcError);
      // continue; respect incRow.allowed if present
    }
    const incRow: UsageIncrementRow | null = Array.isArray(incData)
      ? (incData[0] as UsageIncrementRow)
      : null;
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

    console.log('[extension/enhance] DEBUG: Final response being sent:', {
      hasStructuredData: !!structuredResponse,
      parseMethod,
      hasRawResponse: !structuredResponse && !!enhancedText,
      usageCount: (incRow && typeof incRow.new_usage === 'number') ? incRow.new_usage : undefined
    });

    return createCorsResponse({
      success: true,
      structuredData: structuredResponse,
      rawResponse: structuredResponse ? undefined : (enhancedText as string).trim(),
      usageCount: (incRow && typeof incRow.new_usage === 'number') ? incRow.new_usage : undefined,
      sessionId,
      responseTimeMs: totalResponseTime,
      site: siteLabel,
      chatUrl: chatUrlLabel,
      debug: {
        parseMethod,
        hadStructuredData: !!structuredResponse
      }
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
