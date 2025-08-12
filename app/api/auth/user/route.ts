import { getUser } from '@/lib/supabaseServer';
import { corsJson, corsEmpty } from '@/lib/cors';

export async function GET() {
  const user = await getUser();
  if (!user) {
    return corsJson({ user: null });
  }
  return corsJson({ user });
}

export async function OPTIONS() { return corsEmpty(); }


