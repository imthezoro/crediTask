import { createClient } from '@supabase/supabase-js';
import type { Database } from '../types/database';

// Get environment variables
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// Validate environment variables
if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase environment variables. Please check your .env file.');
}

// Create Supabase client
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false, // Changed to false to avoid conflicts with React Router
    storage: localStorage,
    storageKey: 'freelanceflow-auth',
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

// Export a function to check if a session exists
export const getExistingSession = async () => {
  try {
    const { data, error } = await supabase.auth.getSession();
    if (error) {
      console.error('Error getting session:', error);
      return null;
    }
    return data.session;
  } catch (error) {
    console.error('Error in getExistingSession:', error);
    return null;
  }
};