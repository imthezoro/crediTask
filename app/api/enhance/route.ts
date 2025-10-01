import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { createExtensionJWT } from '@/lib/jwt-utils';
import { validateRequest, sanitizeString } from '@/lib/validation';
import { z } from 'zod';
import { securityMiddleware, addSecurityHeaders } from '@/lib/security-middleware';
import { SecureAuthUtils } from '@/lib/secure-auth-utils';

/**
 * Server-side proxy for prompt enhancement
 * Accepts Supabase session auth, generates JWT, and calls extension enhance API
 */
export async function POST(request: NextRequest) {
  // Apply security middleware with API rate limiting
  const securityCheck = await securityMiddleware(request, 'enhance', {
    requireOriginValidation: true,
    rateLimitType: 'api'
  });
  
  if (!securityCheck.allowed) {
    return addSecurityHeaders(securityCheck.response!);
  }

  try {

    // Authenticate user via Supabase session
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      const response = NextResponse.json(
        { error: 'UNAUTHORIZED', message: 'Please sign in to enhance prompts' },
        { status: 401 }
      );
      return addSecurityHeaders(response);
    }

    // Validate user profile using secure utility (handles soft-delete, blocks, etc.)
    const profileValidation = await SecureAuthUtils.validateUserProfile(user.id);
    
    if (!profileValidation.isValid) {
      // Handle blocked accounts with specific message
      if (profileValidation.isBlocked && profileValidation.blockedUntil) {
        const response = NextResponse.json(
          { 
            error: 'ACCOUNT_BLOCKED', 
            message: 'This account is temporarily blocked.',
            blockedUntil: profileValidation.blockedUntil
          },
          { status: 403 }
        );
        return addSecurityHeaders(response);
      }
      
      // Generic error for other validation failures
      const response = NextResponse.json(
        { error: 'ACCOUNT_DEACTIVATED', message: profileValidation.error || 'Account is not active.' },
        { status: 403 }
      );
      return addSecurityHeaders(response);
    }

    // Parse and validate request body
    const body = await request.json();
    const validation = validateRequest(
      z.object({
        prompt: z.string().min(1).max(10000),
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
      const response = NextResponse.json(
        { error: 'INVALID_INPUT', message: validation.error },
        { status: 400 }
      );
      return addSecurityHeaders(response);
    }

    const { prompt, metadata } = validation.data!;
    const sanitizedPrompt = sanitizeString(prompt);

    // Generate extension JWT for internal API call
    const jwtResult = await createExtensionJWT(user.id, ['enhance']);

    // Call internal extension enhance API
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
    const enhanceApiUrl = `${baseUrl}/api/extension/enhance`;

    console.log('[enhance-proxy] Calling extension API for user:', user.id);

    const enhanceResponse = await fetch(enhanceApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${jwtResult.jwt}`,
      },
      body: JSON.stringify({
        prompt: sanitizedPrompt,
        site: 'webapp',
        chatUrl: null,
        metadata: metadata || {},
      }),
    });

    if (!enhanceResponse.ok) {
      const errorData = await enhanceResponse.json().catch(() => ({}));
      console.error('[enhance-proxy] Extension API error:', errorData);
      
      const response = NextResponse.json(
        {
          error: errorData.error || 'ENHANCEMENT_FAILED',
          message: errorData.message || 'Failed to enhance prompt',
        },
        { status: enhanceResponse.status }
      );
      return addSecurityHeaders(response);
    }

    const enhanceData = await enhanceResponse.json();

    // Return enhanced data to client
    const response = NextResponse.json({
      success: true,
      ...enhanceData,
    }, { status: 200 });
    return addSecurityHeaders(response);

  } catch (error) {
    console.error('[enhance-proxy] Unexpected error:', error);
    const response = NextResponse.json(
      { error: 'INTERNAL_ERROR', message: 'Enhancement service temporarily unavailable' },
      { status: 500 }
    );
    return addSecurityHeaders(response);
  }
}

export async function GET() {
  const response = NextResponse.json(
    { error: 'METHOD_NOT_ALLOWED', message: 'Only POST requests are supported' },
    { status: 405 }
  );
  return addSecurityHeaders(response);
}
