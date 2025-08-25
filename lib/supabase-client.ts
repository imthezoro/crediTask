import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// Memoized singleton client for browser usage to avoid multiple GoTrueClient instances
let browserClient: SupabaseClient | null = null

export const getSupabaseBrowser = (): SupabaseClient => {
  if (!browserClient) {
    browserClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
  }
  return browserClient
}
