import { NextRequest, NextResponse } from 'next/server';
import { verifyExtensionJWT, ExtensionJWTPayload } from '../../../../lib/jwt-utils';
import { enhancePrompt } from '../../../../lib/ai-service';
import { addSecurityHeaders } from '@/lib/security-middleware';
import { 
  validateRequest,
  sanitizeString,
 
} from '@/lib/validation';
import { z } from 'zod';

// Security middleware with rate limiting
import { rateLimiter, getClientIP } from '@/lib/rate-limiter';

export async function POST(request: NextRequest) {
  try {
    // Apply rate limiting
    const clientIP = getClientIP(request);
    const rateLimitKey = `extension-enhance:${clientIP}`;
    
    const rateLimitResult = await rateLimiter.check(clientIP, rateLimitKey, 'enhancePrompt');
    
    if (!rateLimitResult.allowed) {
      return addSecurityHeaders(NextResponse.json(
        { error: 'Too many requests. Please try again in few seconds.' },
        { status: 429 }
      ));
    }

    // Extract and validate Authorization header
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('[extension/enhance] Missing or invalid Authorization header');
      return addSecurityHeaders(
        NextResponse.json(
          { error: 'UNAUTHORIZED', message: 'Bearer token required' },
          { status: 401 }
        )
      );
    }

    // Verify JWT token
    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    let payload: ExtensionJWTPayload;
    try {
      payload = await verifyExtensionJWT(token);
    } catch (jwtError) {
      console.log('[extension/enhance] JWT verification failed:', jwtError);
      return addSecurityHeaders(
        NextResponse.json(
          { error: 'UNAUTHORIZED', message: 'Invalid or expired token' },
          { status: 401 }
        )
      );
    }

    // Validate scope contains 'enhance'
    if (!payload.scope || !payload.scope.includes('enhance')) {
      console.log('[extension/enhance] Insufficient scope:', payload.scope);
      return addSecurityHeaders(
        NextResponse.json(
          { error: 'FORBIDDEN', message: 'Insufficient permissions for enhancement' },
          { status: 403 }
        )
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
      return addSecurityHeaders(
        NextResponse.json(
          { error: 'INVALID_INPUT', message: validation.error },
          { status: 400 }
        )
      );
    }

    const { prompt } = validation.data!;
    const sanitizedPrompt = sanitizeString(prompt);

    // Call AI service to enhance the prompt
    const result = await enhancePrompt(sanitizedPrompt);

    console.log(`[extension/enhance] Enhanced prompt for user ${payload.userId}`);

    return addSecurityHeaders(
      NextResponse.json({
        success: true,
        enhancedPrompt: result.enhancedPrompt,
        structuredData: result.structuredData
      })
    );

  } catch (error) {
    console.error('[extension/enhance] Unexpected error:', error);
    return addSecurityHeaders(
      NextResponse.json(
        { error: 'INTERNAL_ERROR', message: 'Enhancement service temporarily unavailable' },
        { status: 500 }
      )
    );
  }
}
export async function GET() {
  return addSecurityHeaders(
    NextResponse.json(
      { error: 'METHOD_NOT_ALLOWED', message: 'Only POST requests are supported' },
      { status: 405 }
    )
  );
}

export async function PUT() {
  return addSecurityHeaders(
    NextResponse.json(
      { error: 'METHOD_NOT_ALLOWED', message: 'Only POST requests are supported' },
      { status: 405 }
    )
  );
}

export async function DELETE() {
  return addSecurityHeaders(
    NextResponse.json(
      { error: 'METHOD_NOT_ALLOWED', message: 'Only POST requests are supported' },
      { status: 405 }
    )
  );
}
