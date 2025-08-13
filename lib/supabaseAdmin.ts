import { createClient } from '@supabase/supabase-js';

export const supabaseAdmin = (() => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    // Create a dummy that errors when used
    return {
      auth: {
        signInWithPassword: async (): Promise<{ data: null; error: Error }> => ({ data: null, error: new Error('Supabase admin not configured') }),
      },
    } as unknown as ReturnType<typeof createClient>;
  }
  return createClient(url, serviceKey);
})();


