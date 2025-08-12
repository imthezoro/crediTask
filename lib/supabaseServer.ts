import { cookies, headers } from 'next/headers';
import { createClient } from '@supabase/supabase-js';
import { env } from './env';

type AuthedUser = { id: string; email: string } | null;

async function getUserFromToken(accessToken: string | undefined | null): Promise<AuthedUser> {
  if (env.devMockMode) {
    if (!accessToken) return null;
    // accept any token as valid in mock mode
    return { id: 'mock-user-id', email: 'mock@example.com' };
  }
  if (!accessToken) return null;
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
      auth: { persistSession: false },
    }
  );
  const { data, error } = await supabase.auth.getUser(accessToken);
  if (error || !data?.user) return null;
  return { id: data.user.id, email: data.user.email ?? '' };
}

export async function getUser(): Promise<AuthedUser> {
  const cookieStore = cookies();
  const accessTokenFromCookie = cookieStore.get('sb-access-token')?.value;
  if (accessTokenFromCookie) return getUserFromToken(accessTokenFromCookie);

  // Fallback to Authorization header when called from extension
  const authHeader = headers().get('authorization') || headers().get('Authorization');
  const token = authHeader?.toLowerCase().startsWith('bearer ')
    ? authHeader.split(' ')[1]
    : undefined;
  return getUserFromToken(token);
}

export { getUserFromToken };


