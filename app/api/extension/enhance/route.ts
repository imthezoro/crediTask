import { NextRequest, NextResponse } from 'next/server';
import { verifyExtensionJWT, ExtensionJWTPayload } from '../../../../lib/jwt-utils';
import { enhancePrompt } from '../../../../lib/ai-service';
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
      console.log('[extension/enhance] Missing or invalid Authorization header');
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
      console.log('[extension/enhance] JWT verification failed:', jwtError);
      return createCorsResponse(
        { error: 'UNAUTHORIZED', message: 'Invalid or expired token' },
        401,
        request
      );
    }

    // Validate scope contains 'enhance'
    if (!payload.scope || !payload.scope.includes('enhance')) {
      console.log('[extension/enhance] Insufficient scope:', payload.scope);
      return createCorsResponse(
        { error: 'FORBIDDEN', message: 'Insufficient permissions for enhancement' },
        403,
        request
      );
    }

    console.log(`[extension/enhance] Authenticated user: ${payload.userId}`);

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

    // Call AI service to enhance the prompt
    const result = await enhancePrompt(sanitizedPrompt);

    console.log(`[extension/enhance] Enhanced prompt for user ${payload.userId}`);

    return createCorsResponse({
      success: true,
      enhancedPrompt: result.enhancedPrompt,
      structuredData: result.structuredData
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
