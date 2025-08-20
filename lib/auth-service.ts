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

type AuthEventType = 'SIGNED_IN' | 'SIGNED_OUT' | 'TOKEN_REFRESHED';

/**
 * Centralized authentication service for PromptOK
 * Handles Supabase auth operations and extension synchronization
 */
export class AuthService {
  private static instance: AuthService;
  private readonly supabase: SupabaseClient;

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
    const keysToRemove = ['sb-access-token', 'sb-user-data', 'sb-access-token-updated-at'];
    keysToRemove.forEach(key => {
      try {
        localStorage.removeItem(key);
      } catch (error) {
        console.warn(`Failed to remove ${key} from localStorage:`, error);
      }
    });
    
    // Clear cookies
    try {
      document.cookie = 'sb-access-token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; samesite=lax';
    } catch (error) {
      console.warn('Failed to clear auth cookie:', error);
    }
  }

  /**
   * Store authentication data in localStorage and cookies for extension access
   */
  storeAuthData(session: any): void {
    if (typeof window === 'undefined') return;

    try {
      if (session?.access_token) {
        localStorage.setItem('sb-access-token', session.access_token);
        localStorage.setItem('sb-access-token-updated-at', Date.now().toString());
        
        // Set secure cookie
        const isHttps = window.location.protocol === 'https:';
        const secureAttr = isHttps ? '; secure' : '';
        const cookieValue = `sb-access-token=${session.access_token}; path=/; max-age=3600; samesite=lax${secureAttr}`;
        document.cookie = cookieValue;
      }
      
      if (session?.user) {
        const userData = {
          id: session.user.id,
          email: session.user.email,
          user_metadata: session.user.user_metadata || {}
        };
        localStorage.setItem('sb-user-data', JSON.stringify(userData));
      }
    } catch (error) {
      console.error('Failed to store auth data:', error);
    }
  }

  /**
   * Notify browser extension about authentication state changes
   */
  notifyExtension(event: AuthEventType, session?: any): void {
    if (typeof window === 'undefined') return;

    try {
      const timestamp = Date.now();
      
      // Modern message format
      const modernMessage = {
        type: 'WEBSITE_AUTH_UPDATE',
        source: 'website',
        data: {
          event,
          session,
          timestamp
        }
      };
      
      // Legacy message format for backward compatibility
      const legacyMessage = {
        type: 'SUPABASE_AUTH',
        event,
        session
      };
      
      window.postMessage(modernMessage, window.location.origin);
      window.postMessage(legacyMessage, window.location.origin);
    } catch (error) {
      console.error('Failed to notify extension:', error);
    }
  }
}

// Export singleton instance
export const authService = AuthService.getInstance();
