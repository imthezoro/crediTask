import { NextRequest } from 'next/server';
import { z } from 'zod';
import { env } from '@/lib/env';
import { corsJson, corsHeaders } from '@/lib/cors';
import { createClient } from '@supabase/supabase-js';

const ResetPasswordSchema = z.object({ 
  email: z.string().email() 
});

export async function POST(req: NextRequest) {
  // Parse and validate request body
  let email: string;
  try {
    const body = await req.json();
    ({ email } = ResetPasswordSchema.parse(body));
  } catch {
    return corsJson({ error: 'Invalid request' }, { status: 400 });
  }

  try {
    if (env.devMockMode) {
      // In dev mode, just return success without sending email
      return corsJson({ message: 'Reset link sent successfully (mock mode)' });
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !anon) {
      return corsJson({ error: 'Supabase not configured' }, { status: 500 });
    }

    const supabase = createClient(url, anon, {
      global: { headers: { apikey: anon } },
      auth: { persistSession: false },
    });

    // Get the base URL for the reset redirect
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    const redirectTo = `${baseUrl}/auth/reset-password-confirm`;

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo,
    });

    if (error) {
      console.error('Reset password error:', error);
      return corsJson({ error: error.message }, { status: 400 });
    }

    return corsJson({ message: 'Reset link sent successfully' });
  } catch (error: unknown) {
    console.error('/api/auth/reset-password error', error);
    return corsJson({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function OPTIONS(req: NextRequest) {
  const requestHeaders = req.headers.get('access-control-request-headers') || 'Content-Type, Authorization';
  return new Response(null, {
    status: 204,
    headers: { ...corsHeaders, 'Access-Control-Allow-Headers': requestHeaders },
  });
}
