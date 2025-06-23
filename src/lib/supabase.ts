import { createClient } from '@supabase/supabase-js';
import type { Database } from '../types/database';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

console.log('Supabase Configuration Check:', {
  url: supabaseUrl ? 'Present' : 'Missing',
  urlValid: supabaseUrl?.startsWith('https://') && supabaseUrl?.includes('.supabase.co'),
  key: supabaseAnonKey ? 'Present' : 'Missing',
  keyValid: supabaseAnonKey?.length > 50 && supabaseAnonKey?.startsWith('eyJ'),
  environment: import.meta.env.MODE
});

if (!supabaseUrl) {
  console.error('❌ Missing VITE_SUPABASE_URL environment variable');
  throw new Error('Missing VITE_SUPABASE_URL environment variable');
}

if (!supabaseAnonKey) {
  console.error('❌ Missing VITE_SUPABASE_ANON_KEY environment variable');
  throw new Error('Missing VITE_SUPABASE_ANON_KEY environment variable');
}

// Validate URL format
if (!supabaseUrl.startsWith('https://') || !supabaseUrl.includes('.supabase.co')) {
  console.error('❌ Invalid Supabase URL format:', supabaseUrl);
  throw new Error('Invalid Supabase URL format. Should be https://your-project.supabase.co');
}

// Validate key format
if (supabaseAnonKey.length < 50 || !supabaseAnonKey.startsWith('eyJ')) {
  console.error('❌ Invalid Supabase anon key format');
  throw new Error('Invalid Supabase anon key format');
}

console.log('✅ Supabase configuration is valid');

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    flowType: 'pkce',
    debug: import.meta.env.MODE === 'development'
  },
  global: {
    headers: {
      'X-Client-Info': 'freelanceflow-web',
      'X-Client-Version': '1.0.0'
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

// Enhanced connection monitoring
let connectionAttempts = 0;
let lastConnectionCheck = 0;

// Test connection on initialization
const testConnection = async () => {
  const startTime = Date.now();
  connectionAttempts++;
  
  try {
    console.log(`🔄 Testing Supabase connection (attempt ${connectionAttempts})...`);
    
    // Set a timeout for the connection test
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Connection timeout after 10 seconds')), 10000)
    );
    
    const connectionPromise = supabase.from('users').select('count').limit(1);
    
    const { data, error } = await Promise.race([connectionPromise, timeoutPromise]) as any;
    
    const duration = Date.now() - startTime;
    lastConnectionCheck = Date.now();
    
    if (error) {
      console.error('❌ Supabase connection failed:', error.message);
      console.error('Connection details:', {
        duration: `${duration}ms`,
        error: error.message,
        code: error.code,
        hint: error.hint
      });
      return false;
    }
    
    console.log(`✅ Supabase connection successful (${duration}ms)`);
    return true;
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error('❌ Supabase connection error:', error);
    console.error('Connection details:', {
      duration: `${duration}ms`,
      error: error instanceof Error ? error.message : 'Unknown error',
      attempts: connectionAttempts
    });
    return false;
  }
};

// Test connection immediately
testConnection();

// Add error handling for auth state changes with better logging
supabase.auth.onAuthStateChange((event, session) => {
  const timestamp = new Date().toISOString();
  console.log(`🔐 [${timestamp}] Supabase auth event:`, {
    event,
    hasSession: !!session,
    hasUser: !!session?.user,
    userId: session?.user?.id,
    userEmail: session?.user?.email
  });
  
  if (event === 'SIGNED_OUT') {
    console.log('👋 User signed out, clearing cache');
  }
  
  if (event === 'TOKEN_REFRESHED') {
    console.log('🔄 Token refreshed successfully');
  }
  
  if (event === 'SIGNED_IN') {
    console.log('👋 User signed in successfully');
  }
});

// Periodic connection health check
setInterval(async () => {
  const now = Date.now();
  // Check connection every 5 minutes
  if (now - lastConnectionCheck > 5 * 60 * 1000) {
    console.log('🔍 Performing periodic connection health check...');
    await testConnection();
  }
}, 60000); // Check every minute, but only test every 5 minutes

// Export connection test function for manual use
export const testSupabaseConnection = testConnection;

// Export a function to get connection status
export const getConnectionStatus = () => ({
  lastCheck: lastConnectionCheck,
  attempts: connectionAttempts,
  timeSinceLastCheck: Date.now() - lastConnectionCheck
});