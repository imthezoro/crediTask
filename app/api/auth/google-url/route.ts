import { NextRequest } from 'next/server';
import { corsJson, corsHeaders } from '@/lib/cors';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

export async function GET(req: NextRequest) {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !anon) {
      return corsJson({ error: 'Supabase not configured' }, { status: 500 });
    }

    const origin = req.headers.get('origin') || req.headers.get('x-forwarded-host') || req.nextUrl.origin;
    // Ensure we have absolute URL
    const site = origin?.startsWith('http') ? origin : req.nextUrl.origin;
    const redirectTo = `${site}/auth/callback`;

    const supabase = createClient(url, anon, {
      global: { headers: { apikey: anon } },
      auth: { persistSession: false },
    });

    // Generate PKCE code verifier and challenge
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError) {
      console.error('Session error:', sessionError);
      return corsJson(
        { error: 'Failed to initialize session' },
        { status: 500 }
      );
    }

    // Sign in with OAuth
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/auth/callback?redirectTo=${encodeURIComponent(redirectTo)}`,
        skipBrowserRedirect: true,
        queryParams: {
          access_type: 'offline',
          prompt: 'select_account',
        },
      },
    });

    if (error) {
      console.error('Supabase OAuth error:', error);
      return corsJson(
        { error: error.message || 'Failed to generate OAuth URL' },
        { status: 500 }
      );
    }

    if (!data.url) {
      return corsJson(
        { error: 'No URL returned from OAuth provider' },
        { status: 500 }
      );
    }

    return corsJson({ url: data.url });
  } catch (e) {
    console.error('/api/auth/google-url error', e);
    return corsJson(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: { ...corsHeaders } });
}
