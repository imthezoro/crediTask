import { NextRequest } from 'next/server';
import { verifyExtensionJWT, ExtensionJWTPayload } from '../../../../lib/jwt-utils';
import { 
  validateRequest,
  sanitizeString,
} from '@/lib/validation';
import { z } from 'zod';
import { rateLimiter, getClientIP } from '@/lib/rate-limiter';
import { createCorsResponse, corsEmpty } from '@/lib/cors';

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

    // Extract and validate Authorization header
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return createCorsResponse(
        { error: 'UNAUTHORIZED', message: 'Bearer token required' },
        401,
        request
      );
    }

    // Verify JWT token
    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    
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

    const { prompt, site } = validation.data!;
    const sanitizedPrompt = sanitizeString(prompt);

    // Validate environment configuration
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseAnonKey) {
      console.error('[extension/enhance] Missing required environment variables:', {
        hasUrl: !!supabaseUrl,
        hasKey: !!supabaseAnonKey
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

    const edgeFunctionUrl = `${supabaseUrl}/functions/v1/enhance-prompt`;

    // Call Edge Function with extension token in custom header
    // Use anon key for Supabase gateway authentication
    const edgeResponse = await fetch(edgeFunctionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseAnonKey}`,
        'apikey': supabaseAnonKey,
        'x-extension-token': token,
      },
      body: JSON.stringify({ prompt: sanitizedPrompt, site: (typeof site === 'string' ? site : undefined) })
    });

    if (!edgeResponse.ok) {
      const rawError = (await edgeResponse.json().catch(() => ({ error: 'Edge function error' }))) as unknown;
      const errorData: EdgeFunctionError = typeof rawError === 'object' && rawError !== null
        ? (rawError as EdgeFunctionError)
        : { error: 'Edge function error' };
      console.error('[extension/enhance] Edge function failed:', {
        status: edgeResponse.status,
        statusText: edgeResponse.statusText,
        error: errorData,
        provider: errorData.provider,
        provider_status: errorData.provider_status,
        provider_status_text: errorData.provider_status_text,
        provider_response: errorData.provider_response,
      });

      // //Remove the if case in prod to remove the hardcoded resposne
      // // If usage limit (403) is returned by the edge function, provide a simple mock response for testing.
      // if (edgeResponse.status === 403) {
      //   // Original error return preserved below for later re-enable if needed:
      //   // return createCorsResponse(
      //   //   {
      //   //     error: 'ENHANCEMENT_FAILED',
      //   //     message: (errorData as any).message || (errorData as any).error || 'Enhancement service unavailable',
      //   //     provider: (errorData as any).provider,
      //   //     provider_status: (errorData as any).provider_status,
      //   //     provider_status_text: (errorData as any).provider_status_text,
      //   //     provider_response: (errorData as any).provider_response,
      //   //   },
      //   //   edgeResponse.status,
      //   //   request
      //   // );

      //   const mockEnhancedText = `Refined Prompt\n\nPlease improve the following prompt to be clear, specific, and ready to run. Keep the original intent.\n\nOriginal:\n"""\n${sanitizedPrompt}\n"""\n\nReturn the final improved prompt only.`;

      //   const mockStructured = {
      //     enhanced_prompt: `Improve the prompt for clarity and specificity.\n\nOriginal:\n"""\n${sanitizedPrompt}\n"""\n\nReturn a single finalized prompt line.`,
      //     display_excerpt: 'Mock: simple refinement with minimal options.',
      //     assumption_groups: [
      //       {
      //         group_id: 'S1',
      //         title: 'Tone',
      //         description: 'Select a tone',
      //         input_type: 'radio',
      //         options: [
      //           { option_id: 'S1_O1', label: 'Professional', short: 'Neutral, business-like', append_snippet: 'Use a professional, neutral tone.' },
      //           { option_id: 'S1_O2', label: 'Friendly', short: 'Approachable', append_snippet: 'Use a friendly, approachable tone.' }
      //         ]
      //       },
      //       {
      //         group_id: 'S2',
      //         title: 'Format',
      //         description: 'Choose output style',
      //         input_type: 'radio',
      //         options: [
      //           { option_id: 'S2_O1', label: 'Bullets', short: 'Headings + bullets', append_snippet: 'Structure with brief headings and bullet points.' },
      //           { option_id: 'S2_O2', label: 'Single paragraph', short: 'Compact text', append_snippet: 'Provide a single concise paragraph.' }
      //         ]
      //       }
      //     ],
      //     combination_snippets: []
      //   };

      //   return createCorsResponse({
      //     success: true,
      //     enhancedPrompt: mockEnhancedText.trim(),
      //     structuredData: mockStructured,
      //     // usageCount unknown from edge in this path; omit or set to undefined
      //     mock: true,
      //     note: 'Mock response returned due to edge 403 (testing mode)'
      //   }, 200, request);
      // }

      return createCorsResponse(
        {
          error: 'ENHANCEMENT_FAILED',
          message: errorData.message || errorData.error || 'Enhancement service unavailable',
          provider: errorData.provider,
          provider_status: errorData.provider_status,
          provider_status_text: errorData.provider_status_text,
          provider_response: errorData.provider_response,
        },
        edgeResponse.status,
        request
      );
    }

    const result = await edgeResponse.json();

    return createCorsResponse({
      success: true,
      enhancedPrompt: result.enhancedPrompt,
      structuredData: result.structuredData,
      usageCount: result.usageCount,
      sessionId: result.sessionId,
      responseTimeMs: result.responseTimeMs,
      site: result.site,
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
