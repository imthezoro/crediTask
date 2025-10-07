/**
 * Supabase Barrel Export
 */

export { createClient as createBrowserSupabaseClient } from './client'
export {
  createClient as createServerSupabaseClient,
  createAdminClient,
  isUserAdmin,
  getUserEmailsMap,
} from './server'
