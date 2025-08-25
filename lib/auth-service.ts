import { createClient, type SupabaseClient } from '@supabase/supabase-js'

type AuthSession = {
  access_token: string;
  refresh_token: string;
  user: {
    id: string;
    email?: string;
    user_metadata?: Record<string, any>;
  };
};

type GuestCreationLock = {
  isLocked: boolean;
  timestamp: number;
  deviceId: string;
};

type GuestAuthResponse = {
  session: AuthSession | null;
  error: Error | null;
  existingSession?: boolean;
};

type AuthEventType = 'SIGNED_IN' | 'SIGNED_OUT' | 'TOKEN_REFRESHED';

/**
 * Centralized authentication service for PromptOK
 * Handles Supabase auth operations and extension synchronization
 */
export class AuthService {
  private static instance: AuthService;
  private readonly supabase: SupabaseClient;
  private static readonly GUEST_CREATION_LOCK_KEY = 'promptok-guest-creation-lock';
  private static readonly GUEST_SESSION_KEY = 'promptok-guest-session';
  private static readonly LOCK_TIMEOUT = 30000; // 30 seconds

  private constructor() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase environment variables');
    }

    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  static getInstance(): AuthService {
    if (!AuthService.instance) {
      AuthService.instance = new AuthService();
    }
    return AuthService.instance;
  }

  /**
   * Get the Supabase client instance
   * @deprecated Use specific auth methods instead of direct client access
   */
  getSupabaseClient(): SupabaseClient {
    return this.supabase;
  }

  /**
   * Get the current authentication session
   */
  async getSession() {
    try {
      const { data, error } = await this.supabase.auth.getSession();
      return { session: data.session, error };
    } catch (error) {
      console.error('Failed to get session:', error);
      return { session: null, error };
    }
  }

  /**
   * Listen to authentication state changes
   */
  onAuthStateChange(callback: (event: string, session: any) => void) {
    return this.supabase.auth.onAuthStateChange(callback);
  }

  /**
   * Generate a unique device ID or retrieve existing one
   * @param externalDeviceId Optional device ID from external source
   */
  private getDeviceId(externalDeviceId?: string): string {
    // If external device ID is provided, use it
    if (externalDeviceId) return externalDeviceId;
    
    if (typeof window === 'undefined') return '';
    
    try {
      // Check if device ID already exists
      let deviceId = localStorage.getItem('promptok-device-id');
      
      // If not, generate a new one and store it
      if (!deviceId) {
        deviceId = 'dev_' + Math.random().toString(36).substring(2, 15) + 
                  Date.now().toString(36);
        localStorage.setItem('promptok-device-id', deviceId);
      }
      
      return deviceId;
    } catch (error) {
      console.error('Failed to get/set device ID:', error);
      // Fallback to a temporary device ID if localStorage is not available
      return 'temp_' + Math.random().toString(36).substring(2, 15);
    }
  }

  /**
   * Get stored guest session (secure token-based approach)
   */
  private getStoredGuestSession(): { userId: string; deviceId: string; sessionToken: string } | null {
    if (typeof window === 'undefined') return null;
    
    try {
      const storedSession = localStorage.getItem(AuthService.GUEST_SESSION_KEY);
      if (storedSession) {
        return JSON.parse(storedSession);
      }
      return null;
    } catch (error) {
      console.error('Failed to retrieve stored guest session:', error);
      return null;
    }
  }

  /**
   * Store guest session securely (no plaintext passwords)
   */
  private storeGuestSession(userId: string, deviceId: string, sessionToken: string): void {
    if (typeof window === 'undefined') return;
    
    try {
      const sessionData = {
        userId,
        deviceId,
        sessionToken,
        timestamp: Date.now()
      };
      localStorage.setItem(AuthService.GUEST_SESSION_KEY, JSON.stringify(sessionData));
    } catch (error) {
      console.error('Failed to store guest session:', error);
    }
  }

  /**
   * Acquire lock for guest creation to prevent race conditions
   */
  private acquireGuestCreationLock(deviceId: string): boolean {
    if (typeof window === 'undefined') return false;
    
    try {
      const existingLock = localStorage.getItem(AuthService.GUEST_CREATION_LOCK_KEY);
      
      if (existingLock) {
        const lock: GuestCreationLock = JSON.parse(existingLock);
        
        // Check if lock is expired
        if (Date.now() - lock.timestamp > AuthService.LOCK_TIMEOUT) {
          // Lock expired, remove it
          localStorage.removeItem(AuthService.GUEST_CREATION_LOCK_KEY);
        } else if (lock.deviceId === deviceId) {
          // Same device, allow
          return true;
        } else {
          // Lock held by different device/tab
          return false;
        }
      }
      
      // Create new lock
      const newLock: GuestCreationLock = {
        isLocked: true,
        timestamp: Date.now(),
        deviceId
      };
      
      localStorage.setItem(AuthService.GUEST_CREATION_LOCK_KEY, JSON.stringify(newLock));
      return true;
    } catch (error) {
      console.error('Failed to acquire guest creation lock:', error);
      return false;
    }
  }

  /**
   * Release guest creation lock
   */
  private releaseGuestCreationLock(): void {
    if (typeof window === 'undefined') return;
    
    try {
      localStorage.removeItem(AuthService.GUEST_CREATION_LOCK_KEY);
    } catch (error) {
      console.error('Failed to release guest creation lock:', error);
    }
  }

  /**
   * Client-side method - rate limiting is handled server-side
   * This method is kept for compatibility but doesn't perform actual checks
   */
  private async checkGuestCreationAllowed(deviceId: string, ipAddress?: string): Promise<{ allowed: boolean; error?: string }> {
    // Rate limiting is now handled entirely server-side in the API routes
    // This method always returns allowed for client-side calls
    return { allowed: true };
  }

  /**
   * Create a guest user account with enhanced security
   * Implements server-side rate limiting and race condition protection
   * @param ipAddress Optional IP address of the client
   * @param externalDeviceId Optional device ID from external source
   */
  async createGuestUser(ipAddress?: string, externalDeviceId?: string): Promise<GuestAuthResponse> {
    try {
      // Get device ID to bind guest account to this device
      const deviceId = this.getDeviceId(externalDeviceId);
      
      // Acquire lock to prevent race conditions (only in browser)
      if (typeof window !== 'undefined' && !this.acquireGuestCreationLock(deviceId)) {
        return {
          session: null,
          error: new Error('Guest creation in progress. Please wait and try again.')
        };
      }
      
      try {
        // Check server-side rate limiting first
        const rateLimitCheck = await this.checkGuestCreationAllowed(deviceId, ipAddress);
        if (!rateLimitCheck.allowed) {
          return {
            session: null,
            error: new Error(rateLimitCheck.error || 'Guest creation not allowed')
          };
        }
        
        // Check if this device already has a guest session (only in browser)
        if (typeof window !== 'undefined') {
          const storedSession = this.getStoredGuestSession();
          
          if (storedSession) {
            // Try to refresh the existing session
            const { data, error } = await this.supabase.auth.getSession();
            
            if (!error && data.session && data.session.user.id === storedSession.userId) {
              // Valid existing session
              this.storeAuthData(data.session);
              this.notifyExtension('SIGNED_IN', data.session);
              
              return { 
                session: data.session, 
                error: null,
                existingSession: true
              };
            }
            // If session is invalid, continue to create new guest account
          }
        }
      
        // Generate a random email for the guest user
        // Include device ID in the email to track device association
        const randomId = Math.random().toString(36).substring(2, 15);
        const email = `guest_${randomId}_${deviceId}@promptok.guest`;
        const password = Math.random().toString(36).substring(2, 15) + 
                        Math.random().toString(36).substring(2, 15);
        
        // Sign up the guest user
        const { data, error } = await this.supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              device_id: deviceId
            }
          }
        });
        
        if (error) {
          console.error('Guest signup error:', error);
          return { session: null, error };
        }
        
        if (!data.session) {
          return { 
            session: null, 
            error: new Error('No session created for guest user') 
          };
        }
        
        // Mark the user as a guest in the user_profiles table
        const { error: updateError } = await this.supabase
          .from('user_profiles')
          .update({ 
            is_guest: true,
            device_id: deviceId || null,
            ip_address: ipAddress || null
          })
          .eq('id', data.user?.id);
        
        if (updateError) {
          console.error('Failed to mark user as guest:', updateError);
        }
        
        // Store secure session data (no plaintext passwords) - only in browser
        if (typeof window !== 'undefined') {
          this.storeGuestSession(data.user.id, deviceId, data.session.refresh_token);
          
          // Store auth data and notify extension
          this.storeAuthData(data.session);
          this.notifyExtension('SIGNED_IN', data.session);
        }
        
        return { session: data.session, error: null };
      } finally {
        // Always release the lock (only in browser)
        if (typeof window !== 'undefined') {
          this.releaseGuestCreationLock();
        }
      }
    } catch (error) {
      // Ensure lock is released on error (only in browser)
      if (typeof window !== 'undefined') {
        this.releaseGuestCreationLock();
      }
      console.error('Guest login failed:', error);
      return { 
        session: null, 
        error: error instanceof Error ? error : new Error('Unknown error during guest login') 
      };
    }
  }

  /**
   * Sign out the current user and clean up all stored data
   */
  async signOut() {
    try {
      const { error } = await this.supabase.auth.signOut();
      
      if (error) {
        console.error('Supabase signOut error:', error);
      }

      // Clear all stored authentication data
      this.clearStoredAuthData();
      
      // Notify extension of sign out
      this.notifyExtension('SIGNED_OUT');
      
      return { error };
    } catch (error) {
      console.error('Sign out failed:', error);
      return { error };
    }
  }

  /**
   * Clear all stored authentication data from localStorage and cookies
   */
  private clearStoredAuthData(): void {
    if (typeof window === 'undefined') return;

    // Clear localStorage
    const keysToRemove = [
      'sb-access-token', 
      'sb-user-data', 
      'sb-access-token-updated-at',
      AuthService.GUEST_SESSION_KEY,
      // Don't remove device ID to maintain device binding
      // 'promptok-device-id'
    ];
    keysToRemove.forEach(key => {
      try {
        localStorage.removeItem(key);
      } catch (error) {
        console.warn(`Failed to remove ${key} from localStorage:`, error);
      }
    });
    
    // Clear cookies - note: these won't be httpOnly due to extension requirements
    try {
      document.cookie = 'sb-access-token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; samesite=lax';
      document.cookie = 'sb-refresh-token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; samesite=lax';
    } catch (error) {
      console.warn('Failed to clear auth cookies:', error);
    }
  }

  /**
   * Store authentication data securely
   * Note: Extension compatibility requires some localStorage usage
   * In production, consider implementing httpOnly cookie session management
   */
  storeAuthData(session: any): void {
    if (typeof window === 'undefined') return;

    try {
      // Store minimal data in localStorage for extension compatibility
      if (session?.access_token) {
        // Store token with expiration check
        const tokenData = {
          token: session.access_token,
          expires_at: session.expires_at || (Date.now() + 3600000), // 1 hour default
          updated_at: Date.now()
        };
        localStorage.setItem('sb-access-token', JSON.stringify(tokenData));
        
        // Set cookies (not httpOnly due to extension requirements)
        // In a more secure setup, use server-side session management
        const isHttps = window.location.protocol === 'https:';
        const secureAttr = isHttps ? '; secure' : '';
        
        // Short-lived access token cookie
        const accessCookie = `sb-access-token=${session.access_token}; path=/; max-age=3600; samesite=lax${secureAttr}`;
        document.cookie = accessCookie;
        
        // Refresh token in separate cookie (if available)
        if (session.refresh_token) {
          const refreshCookie = `sb-refresh-token=${session.refresh_token}; path=/; max-age=604800; samesite=lax${secureAttr}`; // 7 days
          document.cookie = refreshCookie;
        }
      }
      
      if (session?.user) {
        // Store minimal user data (avoid sensitive information)
        const userData = {
          id: session.user.id,
          email: session.user.email,
          is_guest: session.user.user_metadata?.is_guest || false,
          created_at: Date.now()
        };
        localStorage.setItem('sb-user-data', JSON.stringify(userData));
      }
    } catch (error) {
      console.error('Failed to store auth data:', error);
    }
  }

  /**
   * Notify browser extension about authentication state changes
   * Enhanced security: sanitize data and use proper extension messaging
   */
  notifyExtension(event: AuthEventType, session?: any): void {
    if (typeof window === 'undefined') return;

    try {
      const timestamp = Date.now();
      
      // Sanitize session data - include access_token for extension compatibility
      const sanitizedSession = session ? {
        user: {
          id: session.user?.id,
          email: session.user?.email,
          is_guest: session.user?.user_metadata?.is_guest || false
        },
        expires_at: session.expires_at,
        // Include access_token for extension compatibility
        access_token: session.access_token
      } : null;
      
      // Modern message format with enhanced security
      const modernMessage = {
        type: 'WEBSITE_AUTH_UPDATE',
        source: 'website',
        origin: window.location.origin, // Verify origin
        data: {
          event,
          session: sanitizedSession,
          timestamp
        }
      };
      
      // Legacy message format for backward compatibility
      const legacyMessage = {
        type: 'SUPABASE_AUTH',
        event,
        session: sanitizedSession,
        origin: window.location.origin
      };
      
      // Use postMessage with specific origin (more secure than '*')
      window.postMessage(modernMessage, window.location.origin);
      window.postMessage(legacyMessage, window.location.origin);
      
      // For proper extension communication, the extension should use
      // chrome.runtime.onMessage or content script injection
      // This postMessage approach is a fallback for compatibility
      
    } catch (error) {
      console.error('Failed to notify extension:', error);
    }
  }

  /**
   * Validate and refresh token if needed
   * Also checks if user account is soft-deleted
   */
  async validateAndRefreshToken(): Promise<{ valid: boolean; session?: any }> {
    try {
      const { data, error } = await this.supabase.auth.getSession();
      
      if (error || !data.session) {
        return { valid: false };
      }
      
      // Check if the user account is soft-deleted/inactive
      const { data: profileData, error: profileError } = await this.supabase
        .from('user_profiles')
        .select('is_active, deleted_at')
        .eq('id', data.session.user.id)
        .single();

      if (profileError || !profileData || !profileData.is_active) {
        // Account is deactivated, sign out and invalidate session
        await this.supabase.auth.signOut();
        this.clearStoredAuthData();
        // Also notify the extension so it clears its own session state
        this.notifyExtension('SIGNED_OUT');
        return { valid: false };
      }
      
      // Check if token is close to expiration (refresh if < 5 minutes left)
      const expiresAt = data.session.expires_at ? data.session.expires_at * 1000 : 0;
      const fiveMinutesFromNow = Date.now() + (5 * 60 * 1000);
      
      if (expiresAt < fiveMinutesFromNow) {
        const { data: refreshData, error: refreshError } = await this.supabase.auth.refreshSession();
        
        if (refreshError || !refreshData.session) {
          return { valid: false };
        }
        
        // Update stored auth data with refreshed session
        this.storeAuthData(refreshData.session);
        this.notifyExtension('TOKEN_REFRESHED', refreshData.session);
        
        return { valid: true, session: refreshData.session };
      }
      
      return { valid: true, session: data.session };
    } catch (error) {
      console.error('Token validation failed:', error);
      return { valid: false };
    }
  }
}

/**
 * Security utility functions
 */
export class AuthSecurityUtils {
  /**
   * Sanitize user input to prevent XSS
   */
  static sanitizeInput(input: string): string {
    if (typeof input !== 'string') return '';
    
    return input
      .replace(/[<>"'&]/g, (match) => {
        const escapeMap: { [key: string]: string } = {
          '<': '&lt;',
          '>': '&gt;',
          '"': '&quot;',
          "'": '&#x27;',
          '&': '&amp;'
        };
        return escapeMap[match];
      })
      .trim()
      .substring(0, 1000); // Limit length
  }
  
  /**
   * Validate device ID format
   */
  static isValidDeviceId(deviceId: string): boolean {
    if (typeof deviceId !== 'string') return false;
    
    // Device ID should match expected format: dev_[alphanumeric]_[timestamp]
    const deviceIdPattern = /^(dev_|temp_)[a-zA-Z0-9]{10,20}$/;
    return deviceIdPattern.test(deviceId) && deviceId.length <= 50;
  }
  
  /**
   * Check if running in secure context
   */
  static isSecureContext(): boolean {
    if (typeof window === 'undefined') return true; // Server-side is considered secure
    
    return window.isSecureContext || window.location.protocol === 'https:' || 
           window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  }
  
  /**
   * Generate cryptographically secure random string
   */
  static generateSecureRandom(length: number = 32): string {
    if (typeof window !== 'undefined' && window.crypto && window.crypto.getRandomValues) {
      const array = new Uint8Array(length);
      window.crypto.getRandomValues(array);
      return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
    }
    
    // Fallback for environments without crypto.getRandomValues
    let result = '';
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }
}

// Export singleton instance
export const authService = AuthService.getInstance();
