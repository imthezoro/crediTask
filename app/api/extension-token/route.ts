import { NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { createExtensionJWT, type ExtensionJWTResult } from '@/lib/jwt-utils';
import { securityMiddleware } from '@/lib/security-middleware';
import { createCorsResponse, corsEmpty } from '@/lib/cors';

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
    const cookieStore = cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          },
        },
      }
    );

    // Get current user session
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      console.log('[extension-token] No valid session found');
      return createCorsResponse({ loggedIn: false }, 200, request);
    }

    // Check if user profile exists and is active
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('id, is_active, deleted_at, email, plan, usage_count')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      console.log('[extension-token] User profile not found:', user.id);
      return createCorsResponse({
        loggedIn: false, 
        error: 'User profile not found. Please complete signup in the web app.'
      }, 200, request);
    }

    // Check if user is deactivated or soft-deleted
    if (!profile || !profile.is_active || profile.deleted_at) {
      console.log('[extension-token] User is deactivated or soft-deleted:', user.id);
      return createCorsResponse({ loggedIn: false }, 200, request);
    }

    // Create JWT using the utility function
    const jwtResult: ExtensionJWTResult = await createExtensionJWT(user.id, ['enhance']);

    // Calculate remaining credits - for free plan, assume 10 credits limit
    const usageCount = profile.usage_count || 0;
    const usageLimit = profile.plan === 'pro' ? 1000 : 10; // Default limits based on plan
    const creditsRemaining = Math.max(0, usageLimit - usageCount);

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

    console.log('[extension-token] JWT issued for user:', user.id, 'expires:', new Date(jwtResult.expiresAt).toISOString());

    return createCorsResponse(responseData, 200, request);

  } catch (error) {
    console.error('[extension-token] Error issuing JWT:', error);
    return createCorsResponse({ error: 'Internal server error' }, 500, request);
  }
}
