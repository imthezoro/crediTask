import { createClient } from '@supabase/supabase-js'

// Simplified auth service for extension sync
export class AuthService {
  private static instance: AuthService
  private supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  static getInstance(): AuthService {
    if (!AuthService.instance) {
      AuthService.instance = new AuthService()
    }
    return AuthService.instance
  }

  // Get current session
  async getSession() {
    const { data, error } = await this.supabase.auth.getSession()
    return { session: data.session, error }
  }

  // Listen to auth state changes
  onAuthStateChange(callback: (event: string, session: any) => void) {
    return this.supabase.auth.onAuthStateChange(callback)
  }

  // Sign out
  async signOut() {
    const { error } = await this.supabase.auth.signOut()
    
    // Clear local storage
    localStorage.removeItem('sb-access-token')
    localStorage.removeItem('sb-user-data')
    
    // Clear cookies
    document.cookie = 'sb-access-token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT'
    
    // Notify extension
    window.postMessage(
      { type: 'SUPABASE_AUTH', event: 'SIGNED_OUT' },
      window.location.origin
    )
    
    return { error }
  }

  // Store auth data for extension
  storeAuthData(session: any) {
    if (session?.access_token) {
      localStorage.setItem('sb-access-token', session.access_token)
      
      // Set cookie
      const isHttps = window.location.protocol === 'https:'
      const secureAttr = isHttps ? '; secure' : ''
      document.cookie = `sb-access-token=${session.access_token}; path=/; max-age=3600; samesite=lax${secureAttr}`
    }
    
    if (session?.user) {
      localStorage.setItem('sb-user-data', JSON.stringify({
        id: session.user.id,
        email: session.user.email,
        user_metadata: session.user.user_metadata || {}
      }))
    }
  }

  // Notify extension about auth changes
  notifyExtension(event: string, session?: any) {
    const message = {
      type: 'WEBSITE_AUTH_UPDATE',
      source: 'website',
      data: {
        event,
        session,
        timestamp: Date.now()
      }
    }
    
    window.postMessage(message, window.location.origin)
    
    // Legacy format for backward compatibility
    window.postMessage(
      { type: 'SUPABASE_AUTH', event, session },
      window.location.origin
    )
  }
}

export const authService = AuthService.getInstance()
