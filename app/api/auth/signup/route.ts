import { NextRequest } from 'next/server';
import { z } from 'zod';
import { env } from '@/lib/env';
import { corsJson, corsHeaders } from '@/lib/cors';
import { createClient } from '@supabase/supabase-js';

const SignupSchema = z.object({ email: z.string().email(), password: z.string().min(6) });

export async function POST(req: NextRequest) {
  // Parse and validate request body
  let email: string, password: string;
  try {
    const body = await req.json();
    ({ email, password } = SignupSchema.parse(body));
  } catch {
    return corsJson({ error: 'Invalid request' }, { status: 400 });
  }

  try {
    if (env.devMockMode) {
      return corsJson({ access_token: 'mock-token', user: { id: 'mock-user-id', email }, message: 'Mock signup successful' });
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

    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) {
      return corsJson({ error: error.message }, { status: 400 });
    }

    // If email confirmations are enabled, session may be null
    if (data?.session && data.user) {
      return corsJson({ access_token: data.session.access_token, user: data.user });
    }

    return corsJson({ user: data?.user || null, message: 'Signup successful. Please check your email to confirm your account.' });
  } catch (error: unknown) {
    console.error('/api/auth/signup error', error);
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


