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
    detectSessionInUrl: false,
    flowType: 'pkce',
    debug: false // Reduce console noise
  },
  global: {
    headers: {
      'X-Client-Info': 'freelanceflow-web',
      'X-Client-Version': '1.0.0'
    },
    fetch: (url, options = {}) => {
      return fetch(url, {
        ...options,
        signal: AbortSignal.timeout(15000), // Increased timeout to 15 seconds
      });
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

// Connection monitoring with improved logic
let connectionAttempts = 0;
let lastConnectionCheck = 0;
let connectionStatus: 'unknown' | 'connected' | 'failed' | 'misconfigured' = 'unknown';
let lastError: string | null = null;
let isTestingConnection = false; // Prevent concurrent tests

// Check if configuration is valid
const isConfigurationValid = () => {
  return supabaseUrl && 
         supabaseAnonKey && 
         supabaseUrl.startsWith('https://') && 
         supabaseUrl.includes('.supabase.co') &&
         supabaseAnonKey.length > 50 && 
         supabaseAnonKey.startsWith('eyJ');
};

// Improved connection test with better error handling
const testConnection = async (timeoutMs: number = 12000) => {
  // Prevent concurrent connection tests
  if (isTestingConnection) {
    console.log('🔄 Connection test already in progress, skipping...');
    return connectionStatus === 'connected';
  }

  const startTime = Date.now();
  connectionAttempts++;
  isTestingConnection = true;
  
  // Check configuration first
  if (!isConfigurationValid()) {
    connectionStatus = 'misconfigured';
    lastError = 'Invalid or missing Supabase configuration';
    isTestingConnection = false;
    return false;
  }
  
  try {
    console.log(`🔄 Testing Supabase connection (attempt ${connectionAttempts})...`);
    
    // Use a simple query that's less likely to cause issues
    const { error } = await Promise.race([
      supabase.rpc('ping').then(() => ({ error: null })).catch(err => ({ error: err })),
      new Promise<{ error: Error }>((_, reject) => 
        setTimeout(() => reject(new Error(`Connection timeout after ${timeoutMs / 1000} seconds`)), timeoutMs)
      )
    ]);
    
    const duration = Date.now() - startTime;
    lastConnectionCheck = Date.now();
    isTestingConnection = false;
    
    if (error) {
      connectionStatus = 'failed';
      lastError = error.message;
      
      console.warn('⚠️ Supabase connection failed:', {
        message: error.message,
        duration: `${duration}ms`,
        attempts: connectionAttempts
      });
      
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
    isTestingConnection = false;
    
    console.warn('⚠️ Supabase connection error:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      duration: `${duration}ms`,
      attempts: connectionAttempts
    });
    
    return false;
  }
};

// Debounced connection test - only test if we haven't tested recently
const debouncedConnectionTest = (() => {
  const DEBOUNCE_TIME = 30000; // 30 seconds
  
  return async (timeoutMs?: number) => {
    const now = Date.now();
    if (now - lastConnectionCheck < DEBOUNCE_TIME && connectionStatus !== 'unknown') {
      console.log('🔄 Using cached connection status:', connectionStatus);
      return connectionStatus === 'connected';
    }
    
    return testConnection(timeoutMs);
  };
})();

// Only test connection if configuration is valid and we haven't tested recently
if (isConfigurationValid()) {
  // Test connection with longer delay and timeout for initial load
  setTimeout(() => {
    debouncedConnectionTest(8000).catch(() => {
      // Silently handle initial connection test failures
      if (import.meta.env.MODE === 'development') {
        console.info('ℹ️ Initial Supabase connection test failed silently');
      }
    });
  }, 1000); // Delay initial test by 1 second
} else {
  console.warn('⚠️ Supabase configuration is invalid or missing. Please check your .env file.');
  connectionStatus = 'misconfigured';
}

// Simplified auth state change logging
supabase.auth.onAuthStateChange((event, session) => {
  if (import.meta.env.MODE === 'development') {
    const importantEvents = ['SIGNED_IN', 'SIGNED_OUT', 'TOKEN_REFRESHED'];
    if (importantEvents.includes(event)) {
      console.log(`🔐 Auth: ${event}`, { hasSession: !!session });
    }
  }
  
  // Handle token refresh failures more gracefully
  if (event === 'TOKEN_REFRESHED' && !session) {
    console.warn('⚠️ Token refresh failed - session may be invalid');
    // Don't immediately set connection status to failed
    // Let the auth context handle this
  }
});

// Export connection test function for manual use
export const testSupabaseConnection = async (timeoutMs?: number) => {
  if (!isConfigurationValid()) {
    throw new Error('Supabase configuration is invalid or missing');
  }
  return debouncedConnectionTest(timeoutMs);
};

// Export a function to get connection status
export const getConnectionStatus = () => ({
  status: connectionStatus,
  lastCheck: lastConnectionCheck,
  attempts: connectionAttempts,
  timeSinceLastCheck: Date.now() - lastConnectionCheck,
  lastError,
  isConfigured: isConfigurationValid(),
  isTesting: isTestingConnection
});

// Export a function to reset connection state
export const resetConnectionState = () => {
  connectionAttempts = 0;
  connectionStatus = 'unknown';
  lastConnectionCheck = 0;
  lastError = null;
  isTestingConnection = false;
};

// Export configuration check
export const checkConfiguration = () => ({
  hasUrl: !!supabaseUrl,
  hasKey: !!supabaseAnonKey,
  urlValid: supabaseUrl?.startsWith('https://') && supabaseUrl?.includes('.supabase.co'),
  keyValid: supabaseAnonKey?.length > 50 && supabaseAnonKey?.startsWith('eyJ'),
  isValid: isConfigurationValid()
});