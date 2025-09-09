import { NextRequest, NextResponse } from 'next/server';
import { verifyExtensionJWT, ExtensionJWTPayload } from '../../../../lib/jwt-utils';
import { addSecurityHeaders } from '@/lib/security-middleware';
import { 
  validateRequest,
  sanitizeString,
} from '@/lib/validation';
import { z } from 'zod';
import { rateLimiter, getClientIP } from '@/lib/rate-limiter';
import { getCorsHeaders, createCorsResponse, corsEmpty } from '@/lib/cors';

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
        prompt: z.string().min(1).max(10000)
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

    const { prompt } = validation.data!;
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
      body: JSON.stringify({ prompt: sanitizedPrompt })
    });

    if (!edgeResponse.ok) {
      const errorData = await edgeResponse.json().catch(() => ({ error: 'Edge function error' }));
      console.error('[extension/enhance] Edge function failed:', {
        status: edgeResponse.status,
        statusText: edgeResponse.statusText,
        error: errorData
      });
      return createCorsResponse(
        { error: 'ENHANCEMENT_FAILED', message: errorData.error || 'Enhancement service unavailable' },
        edgeResponse.status,
        request
      );
    }

    const result = await edgeResponse.json();

    return createCorsResponse({
      success: true,
      enhancedPrompt: result.enhancedPrompt,
      structuredData: result.structuredData,
      usageCount: result.usageCount
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
