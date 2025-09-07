import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { securityMiddleware, addSecurityHeaders } from '@/lib/security-middleware';

export async function POST(request: NextRequest) {
  try {
    // Apply security middleware
    const securityResult = await securityMiddleware(request, 'logout', {
      rateLimitType: 'auth',
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
          get(name: string) {
            return cookieStore.get(name)?.value;
          },
          set(name: string, value: string, options: any) {
            cookieStore.set(name, value, options);
          },
          remove(name: string, options: any) {
            cookieStore.delete(name);
          },
        },
      }
    );

    // Sign out the user - this clears the session and cookies
    const { error } = await supabase.auth.signOut();

    if (error) {
      console.error('[logout] Supabase signOut error:', error);
      return addSecurityHeaders(
        NextResponse.json(
          { success: false, error: 'Failed to sign out' },
          { status: 500 }
        )
      );
    }

    console.log('[logout] User signed out successfully');

    return addSecurityHeaders(
      NextResponse.json(
        { success: true, message: 'Signed out successfully' },
        { status: 200 }
      )
    );

  } catch (error) {
    console.error('[logout] Error:', error);
    return addSecurityHeaders(
      NextResponse.json(
        { success: false, error: 'Internal server error' },
        { status: 500 }
      )
    );
  }
}
