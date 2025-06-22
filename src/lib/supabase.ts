import { createClient } from '@supabase/supabase-js';
import type { Database } from '../types/database';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl) {
  throw new Error('Missing VITE_SUPABASE_URL environment variable');
}

if (!supabaseAnonKey) {
  throw new Error('Missing VITE_SUPABASE_ANON_KEY environment variable');
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    flowType: 'pkce',
    storage: window.localStorage,
    storageKey: 'freelanceflow-auth-token',
    debug: process.env.NODE_ENV === 'development'
  },
  global: {
    headers: {
      'X-Client-Info': 'freelanceflow-web'
    }
  },
  db: {
    schema: 'public'
  },
  realtime: {
    params: {
      eventsPerSecond: 10
    }
  }
});

// Enhanced error handling for auth state changes
supabase.auth.onAuthStateChange((event, session) => {
  console.log('Supabase auth event:', event, 'Session:', !!session);
  
  if (event === 'SIGNED_OUT') {
    console.log('User signed out, clearing cache');
    // Clear any cached data
    try {
      localStorage.removeItem('freelanceflow-auth-token');
    } catch (error) {
      console.warn('Could not clear auth token:', error);
    }
  }
  
  if (event === 'TOKEN_REFRESHED') {
    console.log('Token refreshed successfully');
  }
  
  if (event === 'SIGNED_IN') {
    console.log('User signed in successfully');
  }
});

// Add a function to check if we have a valid session
export const checkSession = async () => {
  try {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error) {
      console.error('Session check error:', error);
      return null;
    }
    return session;
  } catch (error) {
    console.error('Session check failed:', error);
    return null;
  }
};

// Add a function to refresh the session
export const refreshSession = async () => {
  try {
    const { data: { session }, error } = await supabase.auth.refreshSession();
    if (error) {
      console.error('Session refresh error:', error);
      return null;
    }
    return session;
  } catch (error) {
    console.error('Session refresh failed:', error);
    return null;
  }
};