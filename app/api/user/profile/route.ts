import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { verifyExtensionJWT } from '@/lib/jwt-utils';
import { addSecurityHeaders } from '@/lib/security';

export async function GET(request: NextRequest) {
  try {
    // Extract JWT from Authorization header
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return addSecurityHeaders(
        NextResponse.json({ error: 'Missing or invalid authorization header' }, { status: 401 })
      );
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Verify the JWT token
    let payload;
    try {
      payload = await verifyExtensionJWT(token);
    } catch (error) {
      console.error('[user/profile] JWT verification failed:', error);
      return addSecurityHeaders(
        NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 })
      );
    }

    // Create Supabase client
    const cookieStore = cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value;
          },
        },
      }
    );

    // Fetch user profile from database
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('id, name, email, plan, usage_count, prompt_limit, is_active, deleted_at')
      .eq('id', payload.userId)
      .single();

    if (profileError || !profile) {
      console.error('[user/profile] Profile not found:', payload.userId);
      return addSecurityHeaders(
        NextResponse.json({ error: 'User profile not found' }, { status: 404 })
      );
    }

    // Check if user is active
    if (!profile.is_active || profile.deleted_at) {
      return addSecurityHeaders(
        NextResponse.json({ error: 'Account is deactivated' }, { status: 403 })
      );
    }

    // Calculate remaining credits based on prompt_limit (null => unlimited)
    const usageLimit: number | null = (profile as { prompt_limit?: number | null })?.prompt_limit ?? null;
    const usageCount = profile.usage_count || 0;
    const creditsRemaining = usageLimit == null ? null : Math.max(0, usageLimit - usageCount);

    const responseData = {
      id: profile.id,
      name: profile.name,
      email: profile.email,
      plan: profile.plan || 'free',
      credits: creditsRemaining,
      usage_count: usageCount,
      usage_limit: usageLimit,
      usage_remaining: creditsRemaining
    };

    return addSecurityHeaders(
      NextResponse.json(responseData, { status: 200 })
    );

  } catch (error) {
    console.error('[user/profile] Error:', error);
    return addSecurityHeaders(
      NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    );
  }
}
