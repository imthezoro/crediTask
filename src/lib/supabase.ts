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

// Enhanced validation with better error messages
if (!supabaseUrl) {
  console.error('❌ Missing VITE_SUPABASE_URL environment variable');
  console.error('💡 Please add VITE_SUPABASE_URL to your .env file');
}

if (!supabaseAnonKey) {
  console.error('❌ Missing VITE_SUPABASE_ANON_KEY environment variable');
  console.error('💡 Please add VITE_SUPABASE_ANON_KEY to your .env file');
}

// Only validate format if variables exist
if (supabaseUrl && (!supabaseUrl.startsWith('https://') || !supabaseUrl.includes('.supabase.co'))) {
  console.error('❌ Invalid Supabase URL format:', supabaseUrl);
  console.error('💡 URL should be in format: https://your-project.supabase.co');
}

if (supabaseAnonKey && (supabaseAnonKey.length < 50 || !supabaseAnonKey.startsWith('eyJ'))) {
  console.error('❌ Invalid Supabase anon key format');
  console.error('💡 Key should start with "eyJ" and be longer than 50 characters');
}

// Create client with fallback values to prevent crashes
const clientUrl = supabaseUrl || 'https://placeholder.supabase.co';
const clientKey = supabaseAnonKey || 'placeholder-key';

export const supabase = createClient<Database>(clientUrl, clientKey, {
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
let connectionStatus: 'unknown' | 'connected' | 'failed' | 'misconfigured' = 'unknown';
let lastError: string | null = null;

// Check if configuration is valid
const isConfigurationValid = () => {
  return supabaseUrl && 
         supabaseAnonKey && 
         supabaseUrl.startsWith('https://') && 
         supabaseUrl.includes('.supabase.co') &&
         supabaseAnonKey.length > 50 && 
         supabaseAnonKey.startsWith('eyJ');
};

// Test connection with better error handling and graceful degradation
const testConnection = async (timeoutMs: number = 5000) => {
  const startTime = Date.now();
  connectionAttempts++;
  
  // Check configuration first
  if (!isConfigurationValid()) {
    connectionStatus = 'misconfigured';
    lastError = 'Invalid or missing Supabase configuration';
    console.warn('⚠️ Supabase configuration is invalid - skipping connection test');
    return false;
  }
  
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
      lastError = error.message;
      
      // Only log detailed errors in development and reduce noise
      if (import.meta.env.MODE === 'development') {
        console.warn('⚠️ Supabase connection failed:', {
          message: error.message,
          code: error.code,
          duration: `${duration}ms`
        });
        
        // Provide more specific error guidance
        if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
          console.info('💡 Network connectivity issue detected. Please check your Supabase configuration.');
        } else if (error.message.includes('Invalid API key') || error.code === 'PGRST301') {
          console.info('💡 Authentication issue detected. Please verify your VITE_SUPABASE_ANON_KEY.');
        }
      }
      
      return false;
    }
    
    connectionStatus = 'connected';
    lastError = null;
    console.log(`✅ Supabase connection successful (${duration}ms)`);
    return true;
  } catch (error) {
    const duration = Date.now() - startTime;
    connectionStatus = 'failed';
    lastError = error instanceof Error ? error.message : 'Unknown error';
    
    // Reduce console noise - only log once per session for timeouts
    if (import.meta.env.MODE === 'development' && connectionAttempts <= 3) {
      console.warn('⚠️ Supabase connection error:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        duration: `${duration}ms`,
        attempts: connectionAttempts
      });
      
      // Provide troubleshooting guidance based on error type
      if (error instanceof Error && error.message.includes('timeout')) {
        console.info('💡 Connection timeout detected. This usually means:');
        console.info('   - Your Supabase project credentials may be incorrect');
        console.info('   - Your Supabase project may be paused or inactive');
        console.info('   - Network connectivity issues');
        console.info('   - Please use the diagnostics tool on the login page for detailed troubleshooting');
      }
    }
    
    return false;
  }
};

// Only test connection if configuration is valid and limit initial attempts
if (isConfigurationValid()) {
  // Test connection immediately with shorter timeout for faster feedback
  testConnection(3000).catch(() => {
    // Silently handle initial connection test failures to reduce console noise
    if (import.meta.env.MODE === 'development') {
      console.info('ℹ️ Initial Supabase connection test failed. Use the diagnostics tool for detailed troubleshooting.');
    }
  });
} else {
  console.warn('⚠️ Supabase configuration is invalid or missing. Please check your .env file.');
  connectionStatus = 'misconfigured';
}

// Add error handling for auth state changes with better logging
supabase.auth.onAuthStateChange((event, session) => {
  // Only log important events in development to reduce noise
  if (import.meta.env.MODE === 'development' && ['SIGNED_IN', 'SIGNED_OUT', 'TOKEN_REFRESHED'].includes(event)) {
    console.log(`🔐 Auth event: ${event}`, {
      hasSession: !!session,
      userId: session?.user?.id
    });
  }
});

// Periodic connection health check with exponential backoff - but less aggressive
let healthCheckInterval: number | null = null;
let healthCheckDelay = 300000; // Start with 5 minutes to reduce noise

const startHealthCheck = () => {
  // Only start health checks if configuration is valid
  if (!isConfigurationValid()) {
    return;
  }
  
  if (healthCheckInterval) {
    clearInterval(healthCheckInterval);
  }
  
  healthCheckInterval = setInterval(async () => {
    const now = Date.now();
    // Only check if we haven't checked recently and connection was previously failed
    if (connectionStatus === 'failed' && now - lastConnectionCheck > healthCheckDelay) {
      const success = await testConnection(3000);
      
      if (success) {
        // Reset delay on successful connection
        healthCheckDelay = 300000;
      } else {
        // Exponential backoff up to 30 minutes
        healthCheckDelay = Math.min(healthCheckDelay * 1.5, 1800000);
      }
    }
  }, 300000); // Check every 5 minutes instead of 30 seconds
};

startHealthCheck();

// Export connection test function for manual use
export const testSupabaseConnection = async (timeoutMs?: number) => {
  if (!isConfigurationValid()) {
    throw new Error('Supabase configuration is invalid or missing');
  }
  return testConnection(timeoutMs);
};

// Export a function to get connection status
export const getConnectionStatus = () => ({
  status: connectionStatus,
  lastCheck: lastConnectionCheck,
  attempts: connectionAttempts,
  timeSinceLastCheck: Date.now() - lastConnectionCheck,
  lastError,
  isConfigured: isConfigurationValid()
});

// Export a function to reset connection state
export const resetConnectionState = () => {
  connectionAttempts = 0;
  connectionStatus = 'unknown';
  lastConnectionCheck = 0;
  lastError = null;
};

// Export configuration check
export const checkConfiguration = () => ({
  hasUrl: !!supabaseUrl,
  hasKey: !!supabaseAnonKey,
  urlValid: supabaseUrl?.startsWith('https://') && supabaseUrl?.includes('.supabase.co'),
  keyValid: supabaseAnonKey?.length > 50 && supabaseAnonKey?.startsWith('eyJ'),
  isValid: isConfigurationValid()
});