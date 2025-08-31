import { createClient } from '@/lib/supabase-client'
import { createClient as createServerClient } from '@/lib/supabase-server'

export class AuthService {
  private supabase = createClient()

  /**
   * Sign in as guest using anonymous authentication
   */
  async signInAsGuest(): Promise<{
    success: boolean
    error?: string
    errorType?: string
    user?: any
  }> {
    try {
      const response = await fetch('/api/auth/guest-login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      const result = await response.json()

      if (!response.ok) {
        return {
          success: false,
          error: result.error || 'Failed to create guest session',
          errorType: result.errorType
        }
      }

      return {
        success: true,
        user: result.user
      }
    } catch (error) {
      console.error('Guest sign-in error:', error)
      return {
        success: false,
        error: 'Network error occurred'
      }
    }
  }

  /**
   * Check if current user is a guest
   */
  async isGuestUser(): Promise<boolean> {
    try {
      const { data: { user } } = await this.supabase.auth.getUser()
      return user?.is_anonymous === true
    } catch {
      return false
    }
  }

  /**
   * Get current user session
   */
  async getCurrentUser() {
    try {
      const { data: { user }, error } = await this.supabase.auth.getUser()
      if (error) throw error
      return user
    } catch (error) {
      console.error('Get user error:', error)
      return null
    }
  }

  /**
   * Sign out current user
   */
  async signOut(): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await this.supabase.auth.signOut()
      if (error) throw error
      
      return { success: true }
    } catch (error) {
      console.error('Sign out error:', error)
      return {
        success: false,
        error: 'Failed to sign out'
      }
    }
  }

  /**
   * Listen to auth state changes
   */
  onAuthStateChange(callback: (event: string, session: any) => void) {
    return this.supabase.auth.onAuthStateChange(callback)
  }
}

// Singleton instance
export const authService = new AuthService()
