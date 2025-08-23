import { NextRequest } from 'next/server';
import { z } from 'zod';
import { env } from '@/lib/env';
import { corsJson, corsHeaders } from '@/lib/cors';
import { createClient } from '@supabase/supabase-js';

const LoginSchema = z.object({ email: z.string().email(), password: z.string().min(6) });

export async function POST(req: NextRequest) {
  // Parse and validate request body with a 400 response on failure
  let email: string, password: string, deviceId: string | undefined;
  try {
    const body = await req.json();
    ({ email, password } = LoginSchema.parse(body));
    deviceId = body.device_id;
  } catch {
    return corsJson({ error: 'Invalid request' }, { status: 400 });
  }

  // Handle authentication with proper error reporting
  try {
    if (env.devMockMode) {
      // Accept any credentials and return a mock token
      return corsJson({ access_token: 'mock-token', user: { id: 'mock-user-id', email } });
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
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data?.session || !data.user) {
      return corsJson({ error: error?.message || 'Invalid credentials' }, { status: 401 });
    }
    
    // Get client IP address from request
    const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 
                    req.headers.get('x-real-ip') || 
                    req.ip || 
                    'unknown';
    
    // If no device_id provided, generate one
    if (!deviceId || deviceId.trim() === "") {
      deviceId = 'dev_' + Math.random().toString(36).substring(2, 15) + 
                Date.now().toString(36);
    }
    
    // Update user_profiles with ip_address and device_id
    if (data.user.id) {
      await supabase
        .from('user_profiles')
        .update({ 
          ip_address: clientIp,
          device_id: deviceId
        })
        .eq('id', data.user.id);
    }
    
    return corsJson({ 
      access_token: data.session.access_token, 
      user: data.user,
      device_id: deviceId 
    });
  } catch (error: unknown) {
    console.error('/api/auth/login error', error);
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


