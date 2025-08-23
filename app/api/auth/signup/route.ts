import { NextRequest } from 'next/server';
import { z } from 'zod';
import { env } from '@/lib/env';
import { corsJson, corsHeaders } from '@/lib/cors';
import { createClient } from '@supabase/supabase-js';

const SignupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().trim().min(1).max(200).optional(),
});

export async function POST(req: NextRequest) {
  // Parse and validate request body
  let email: string, password: string, name: string | undefined, deviceId: string | undefined;
  try {
    const body = await req.json();
    ({ email, password, name, device_id: deviceId } = { ...SignupSchema.parse(body), device_id: body.device_id });
  } catch {
    return corsJson({ error: 'Invalid request' }, { status: 400 });
  }

  try {
    if (env.devMockMode) {
      return corsJson({
        access_token: 'mock-token',
        user: { id: 'mock-user-id', email },
        message: 'Mock signup successful',
      });
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

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: name ? { full_name: name } : undefined,
      },
    });
    if (error) {
      return corsJson({ error: error.message }, { status: 400 });
    }

    // If email confirmations are enabled, session may be null
    if (data?.session && data.user) {
      const clientIp =
        req.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
        req.headers.get('x-real-ip') ||
        'unknown';

      // If no device_id provided, generate one
      if (!deviceId) {
        deviceId = 'dev_' + Math.random().toString(36).substring(2, 15) + 
                  Date.now().toString(36);
      }
      
      // Note: We can't store in localStorage here as this is a server component
      // The device_id will be returned to the client in the response

      // Update user_profiles with device_id and ip_address
      if (data.user.id) {
        await supabase
          .from('user_profiles')
          .update({
            ip_address: clientIp,
            device_id: deviceId,
          })
          .eq('id', data.user.id);
      }

      return corsJson({
        access_token: data.session.access_token,
        user: data.user,
        device_id: deviceId,
      });
    }

    // Fallback: user created, but no session (confirmation required)
    return corsJson({
      user: data?.user || null,
      message: 'Signup successful. Please check your email to confirm your account.',
    });
  } catch (error: unknown) {
    console.error('/api/auth/signup error', error);
    return corsJson({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function OPTIONS(req: NextRequest) {
  const requestHeaders =
    req.headers.get('access-control-request-headers') || 'Content-Type, Authorization';
  return new Response(null, {
    status: 204,
    headers: { ...corsHeaders, 'Access-Control-Allow-Headers': requestHeaders },
  });
}
