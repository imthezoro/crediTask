import { NextRequest } from 'next/server';
import { createExtensionJWT, type ExtensionJWTResult } from '@/lib/jwt-utils';
import { securityMiddleware } from '@/lib/security';
import { createCorsResponse, corsEmpty } from '@/lib/cors';
import { createClient } from '@/lib/supabase/server';

// Handle preflight OPTIONS requests
export async function OPTIONS(request: NextRequest) {
  return corsEmpty(200, request);
}

export async function GET(request: NextRequest) {
  try {
    // Apply security middleware with auth-sensitive rate limiting
    const securityResult = await securityMiddleware(request, 'extension-token', {
      rateLimitType: 'auth-sensitive',
      skipRateLimit: false,
    });

    if (!securityResult.allowed) {
      return securityResult.response;
    }

    // Create Supabase SSR client
    const supabase = await createClient();

    // Get current user session
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      // SECURITY: Don't log auth failures as they're expected behavior
      return createCorsResponse({ loggedIn: false }, 200, request);
    }

    // Check if user profile exists and is active
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('id, is_active, deleted_at, email, plan, usage_count, prompt_limit')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      // SECURITY: Don't log user IDs
      console.error('[extension-token] User profile not found');
      return createCorsResponse({
        loggedIn: false, 
        error: 'User profile not found. Please complete signup in the web app.'
      }, 200, request);
    }

    // Check if user is deactivated or soft-deleted
    if (!profile.is_active || profile.deleted_at) {
      // SECURITY: Don't log user IDs
      return createCorsResponse({ loggedIn: false }, 200, request);
    }

    // Create JWT using the utility function
    const jwtResult: ExtensionJWTResult = await createExtensionJWT(user.id, ['enhance']);

    // Calculate remaining credits based on prompt_limit (null => unlimited)
    const usageCount = profile.usage_count || 0;
    const usageLimit: number | null = (profile as { prompt_limit?: number | null })?.prompt_limit ?? null;
    const creditsRemaining = usageLimit == null ? null : Math.max(0, usageLimit - usageCount);

    // Extract name from user metadata or email
    const userName = user.user_metadata?.full_name || 
                    user.user_metadata?.name || 
                    user.email?.split('@')[0] || 
                    'User';

    // Include user profile data in the response
    const responseData = {
      ...jwtResult,
      loggedIn: true,
      user: {
        id: profile.id,
        name: userName,
        email: user.email || profile.email,
        plan: profile.plan || 'free',
        credits: creditsRemaining,
        usage_count: usageCount,
        usage_limit: usageLimit,
        usage_remaining: creditsRemaining
      }
    };

    // SECURITY: Only log in development
    if (process.env.NODE_ENV === 'development') {
      console.log('[extension-token] JWT issued, expires:', new Date(jwtResult.expiresAt).toISOString());
    }

    return createCorsResponse(responseData, 200, request);

  } catch (error) {
    console.error('[extension-token] Error issuing JWT:', error);
    return createCorsResponse({ error: 'Internal server error' }, 500, request);
  }
}
