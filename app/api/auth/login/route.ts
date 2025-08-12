import { NextRequest } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { env } from '@/lib/env';
import { corsJson, corsEmpty } from '@/lib/cors';

const LoginSchema = z.object({ email: z.string().email(), password: z.string().min(6) });

export async function POST(req: NextRequest) {
  try {
    const json = await req.json();
    const { email, password } = LoginSchema.parse(json);

    if (env.devMockMode) {
      // Accept any credentials and return a mock token
      return corsJson({ access_token: 'mock-token', user: { id: 'mock-user-id', email } });
    }

    const { data, error } = await supabaseAdmin.auth.signInWithPassword({ email, password });
    if (error || !data?.session) {
      return corsJson({ error: 'Invalid credentials' }, { status: 401 });
    }

    return corsJson({ access_token: data.session.access_token, user: data.user });
  } catch (error: any) {
    console.error('/api/auth/login error', error);
    return corsJson({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function OPTIONS() { return corsEmpty(); }


