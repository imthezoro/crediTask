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
let connectionStatus: 'unknown' | 'connected' | 'failed' = 'unknown';

// Test connection with better error handling and shorter timeout
const testConnection = async (timeoutMs: number = 5000) => {
  const startTime = Date.now();
  connectionAttempts++;
  
  try {
    console.log(`🔄 Testing Supabase connection (attempt ${connectionAttempts})...`);
    
    // Create a more specific timeout promise
    const timeoutPromise = new Promise<never>((_, reject) => 
      setTimeout(() => reject(new Error(`Connection timeout after ${timeoutMs / 1000} seconds`)), timeoutMs)
    );
    
    // Use a simpler query that's less likely to fail
    const connectionPromise = supabase.rpc('version');
    
    const { data, error } = await Promise.race([connectionPromise, timeoutPromise]);
    
    const duration = Date.now() - startTime;
    lastConnectionCheck = Date.now();
    
    if (error) {
      connectionStatus = 'failed';
      console.error('❌ Supabase connection failed:', {
        message: error.message,
        code: error.code,
        hint: error.hint,
        details: error.details,
        duration: `${duration}ms`
      });
      
      // Provide more specific error guidance
      if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
        console.error('💡 This appears to be a network connectivity issue. Please check:');
        console.error('   - Your internet connection');
        console.error('   - Firewall or proxy settings');
        console.error('   - Whether your Supabase project is active');
      } else if (error.message.includes('Invalid API key') || error.code === 'PGRST301') {
        console.error('💡 This appears to be an authentication issue. Please check:');
        console.error('   - Your VITE_SUPABASE_ANON_KEY is correct');
        console.error('   - Your Supabase project settings');
      }
      
      return false;
    }
    
    connectionStatus = 'connected';
    console.log(`✅ Supabase connection successful (${duration}ms)`);
    return true;
  } catch (error) {
    const duration = Date.now() - startTime;
    connectionStatus = 'failed';
    
    console.error('❌ Supabase connection error:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      duration: `${duration}ms`,
      attempts: connectionAttempts
    });
    
    // Provide troubleshooting guidance based on error type
    if (error instanceof Error) {
      if (error.message.includes('timeout')) {
        console.error('💡 Connection timeout suggests:');
        console.error('   - Network connectivity issues');
        console.error('   - Supabase project may be paused or unavailable');
        console.error('   - Firewall blocking the connection');
      } else if (error.message.includes('fetch')) {
        console.error('💡 Fetch error suggests:');
        console.error('   - CORS issues (check your Supabase project settings)');
        console.error('   - Invalid Supabase URL');
        console.error('   - Network connectivity problems');
      }
    }
    
    return false;
  }
};

// Test connection immediately with shorter timeout for faster feedback
testConnection(3000);

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

// Periodic connection health check with exponential backoff
let healthCheckInterval: number | null = null;
let healthCheckDelay = 60000; // Start with 1 minute

const startHealthCheck = () => {
  if (healthCheckInterval) {
    clearInterval(healthCheckInterval);
  }
  
  healthCheckInterval = setInterval(async () => {
    const now = Date.now();
    // Only check if we haven't checked recently and connection was previously failed
    if (connectionStatus === 'failed' && now - lastConnectionCheck > healthCheckDelay) {
      console.log('🔍 Performing connection health check...');
      const success = await testConnection(3000);
      
      if (success) {
        // Reset delay on successful connection
        healthCheckDelay = 60000;
      } else {
        // Exponential backoff up to 10 minutes
        healthCheckDelay = Math.min(healthCheckDelay * 1.5, 600000);
      }
    }
  }, 30000); // Check every 30 seconds
};

startHealthCheck();

// Export connection test function for manual use
export const testSupabaseConnection = (timeoutMs?: number) => testConnection(timeoutMs);

// Export a function to get connection status
export const getConnectionStatus = () => ({
  status: connectionStatus,
  lastCheck: lastConnectionCheck,
  attempts: connectionAttempts,
  timeSinceLastCheck: Date.now() - lastConnectionCheck
});

// Export a function to reset connection state
export const resetConnectionState = () => {
  connectionAttempts = 0;
  connectionStatus = 'unknown';
  lastConnectionCheck = 0;
};