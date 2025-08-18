import { getUser } from '@/lib/supabaseServer';
import { corsJson, corsEmpty } from '@/lib/cors';
import { createClient } from '@supabase/supabase-js';
import { headers } from 'next/headers';

export async function GET() {
  try {
    // Get the full user object from Supabase instead of the simplified one
    const authHeader = headers().get('authorization') || headers().get('Authorization');
    const token = authHeader?.toLowerCase().startsWith('bearer ')
      ? authHeader.split(' ')[1]
      : undefined;
    
    if (!token) {
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


