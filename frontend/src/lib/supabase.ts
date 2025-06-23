import { createClient } from '@supabase/supabase-js';
import type { Database } from '../types/database';

// Get environment variables
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// Create Supabase client
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    flowType: 'pkce',
    storage: window.localStorage,
    storageKey: 'freelanceflow-auth'
  },
  global: {
    headers: {
      'X-Client-Info': 'freelanceflow-web'
    }
  },
  db: {
    schema: 'public'
  }
});

// Enhanced error handling for auth state changes
supabase.auth.onAuthStateChange((event, session) => {
  console.log('🔐 Supabase auth event:', event, 'Session exists:', !!session);
  
  if (event === 'SIGNED_OUT') {
    console.log('👋 User signed out, clearing local storage');
    // Clear any app-specific storage
    try {
      localStorage.removeItem('freelanceflow-user');
      sessionStorage.clear();
    } catch (error) {
      console.warn('Could not clear storage:', error);
    }
  }
  
  if (event === 'TOKEN_REFRESHED') {
    console.log('🔄 Token refreshed successfully');
  }
  
  if (event === 'SIGNED_IN') {
    console.log('✅ User signed in successfully');
  }

  if (event === 'INITIAL_SESSION') {
    console.log('🔍 Initial session loaded:', !!session);
  }
});