import { corsJson, corsEmpty } from '@/lib/cors';
import { createClient } from '@supabase/supabase-js';
import { headers } from 'next/headers';

export async function GET() {
  try {
    // Get the full user object from Supabase instead of the simplified one
    const authHeader = headers().get('authorization') || headers().get('Authorization');
    console.log('API /auth/user - Auth header:', authHeader ? 'present' : 'missing');
    
    const token = authHeader?.toLowerCase().startsWith('bearer ')
      ? authHeader.split(' ')[1]
      : undefined;
    
    console.log('API /auth/user - Extracted token:', {
      hasToken: !!token,
      tokenLength: token?.length,
      tokenStart: token?.substring(0, 20) + '...',
      isValidJWTFormat: token ? token.split('.').length === 3 : false
    });
    
    if (!token) {
      console.log('API /auth/user - No token provided');
      return corsJson({ user: null });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: { headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, Authorization: `Bearer ${token}` } },
        auth: { persistSession: false },
      }
    );
    
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data?.user) {
      console.error('Supabase getUser error:', error);
      return corsJson({ user: null });
    }
    
    // Return the full user object so frontend gets all metadata
    return corsJson({ user: data.user });
  } catch (error) {
    console.error('API /auth/user error:', error);
    return corsJson({ user: null });
  }
}

export async function OPTIONS() { return corsEmpty(); }


