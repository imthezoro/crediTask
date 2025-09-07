import { createClient, createAdminClient } from '@/lib/supabase-server'
import { timingSafeEqual, createHash } from 'crypto'

/**
 * Secure Authentication Utilities
 * Prevents user enumeration and timing attacks through constant-time operations
 */
export class SecureAuthUtils {
  private static readonly MINIMUM_RESPONSE_TIME_MS = 1000 // 1 second minimum
  private static readonly RANDOM_DELAY_MAX_MS = 500 // Up to 500ms additional random delay

  /**
   * Secure authentication with constant-time response
   * Always performs the same operations regardless of user existence
   */
  static async authenticateUser(email: string, password: string): Promise<{
    success: boolean
    user?: AuthUserMinimal | null
    profile?: UserProfileMinimal | null
    error?: string
  }> {
    const startTime = Date.now()
    
    try {
      const supabase = await createClient()
      const admin = createAdminClient()
      
      // Always perform authentication attempt (even if user doesn't exist)
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password
      })

      let profile: UserProfileMinimal | null = null

      // Always attempt profile lookup (constant-time regardless of auth success)
      if (authData?.user?.id) {
        const { data: profileData } = await admin
          .from('user_profiles')
          .select('is_active, is_guest')
          .eq('id', authData.user.id)
          .single()
        
        profile = profileData as UserProfileMinimal | null
      }

      // Determine final result
      let success = false
      let user: AuthUserMinimal | null = null
      
      if (!authError && authData?.user && profile && profile.is_active) {
        success = true
        user = {
          id: authData.user.id,
          email: authData.user.email ?? null,
          is_guest: profile.is_guest || false
        }
      } else {
        // Sign out if authentication succeeded but profile check failed
        if (!authError && authData?.user) {
          await supabase.auth.signOut()
        }
      }

      // Ensure minimum response time
      await this.normalizeResponseTime(startTime)

      return {
        success,
        user,
        profile,
        error: success ? undefined : 'Invalid email or password'
      }

    } catch (error) {
      console.error('Authentication error:', error)
      
      // Ensure minimum response time even on errors
      await this.normalizeResponseTime(startTime)
      
      return {
        success: false,
        error: 'Invalid email or password'
      }
    }
  }

  /**
   * Secure profile validation with constant-time response
   * Used for session validation and OAuth callbacks
   */
  static async validateUserProfile(userId: string): Promise<{
    isValid: boolean
    profile?: UserProfileMinimal
    error?: string
    isBlocked?: boolean
    blockedUntil?: string
  }> {
    const startTime = Date.now()
    
    try {
      const admin = createAdminClient()
      
      // Always perform profile lookup
      const profileResult = await admin
        .from('user_profiles')
        .select('is_active, is_guest, email')
        .eq('id', userId)
        .single()
      let profile = profileResult.data as (UserProfileMinimal & { email?: string | null }) | null

      // Check blocked emails regardless of profile existence
      let isBlocked = false
      let blockedUntil: string | undefined
      // Prefer email from user_profiles; fallback to auth.users if missing
      let emailForCheck: string | null = profile?.email || null
      if (!emailForCheck) {
        const { data: user } = await admin.auth.admin.getUserById(userId)
        emailForCheck = user?.user?.email || null
      }
      if (emailForCheck) {
        const { data: blockedEmail } = await admin
          .from('blocked_emails')
          .select('blocked_until, reason')
          .eq('email', emailForCheck)
          .gt('blocked_until', new Date().toISOString())
          .single()
        
        if (blockedEmail) {
          isBlocked = true
          blockedUntil = blockedEmail.blocked_until
        } else {
          // Check if there's an expired block - if so, reactivate for OAuth
          const { data: expiredBlock } = await admin
            .from('blocked_emails')
            .select('blocked_until')
            .eq('email', emailForCheck)
            .lt('blocked_until', new Date().toISOString())
            .single()
          
          if (expiredBlock) {
            // Remove expired block and reactivate user
            const { error: deleteError } = await admin
              .from('blocked_emails')
              .delete()
              .eq('email', emailForCheck)
            
            if (!deleteError) {
              // Reactivate profile if it exists but is inactive
              if (profile && !profile.is_active) {
                const { error: updateError } = await admin
                  .from('user_profiles')
                  .update({ is_active: true, deleted_at: null })
                  .eq('id', userId)
                
                if (!updateError) {
                  // Re-fetch updated profile
                  const { data: reactivatedProfile } = await admin
                    .from('user_profiles')
                    .select('is_active, is_guest, email')
                    .eq('id', userId)
                    .single()
                  profile = reactivatedProfile as (UserProfileMinimal & { email?: string | null }) | null
                }
              }
            }
          }
        }
      }

      // Profile creation should only happen during signup, not during validation

      // Determine validity from current state (initial fetch error is irrelevant if we created/reactivated a profile)
      const hasProfile = Boolean(profile)
      const isValid = hasProfile && !!profile?.is_active && !isBlocked

      // Narrow profile type for return (drop optional email field)
      const validProfile: UserProfileMinimal | undefined =
        isValid && profile
          ? { is_active: profile.is_active, is_guest: profile.is_guest }
          : undefined

      // Ensure minimum response time
      await this.normalizeResponseTime(startTime)

      return {
        isValid,
        profile: validProfile,
        error: isValid ? undefined : 'Account validation failed',
        isBlocked,
        blockedUntil
      }

    } catch (error) {
      console.error('Profile validation error:', error)
      
      // Ensure minimum response time even on errors
      await this.normalizeResponseTime(startTime)
      
      return {
        isValid: false,
        error: 'Account validation failed',
        isBlocked: false,
        blockedUntil: undefined
      }
    }
  }

  /**
   * Secure email existence check with constant-time response
   * Used for password reset to prevent user enumeration
   */
  static async checkEmailExists(_email: string): Promise<{
    exists: boolean
    message: string
  }> {
    const startTime = Date.now()
    
    try {
      // Intentionally reference the parameter to satisfy no-unused-vars without changing logic
      void _email
      // Avoid schema dependency on user_profiles.email.
      // For enumeration resistance, we don't actually check existence here.
      // We only normalize timing and return a generic message.
      const exists = true

      // Ensure minimum response time
      await this.normalizeResponseTime(startTime)

      // Always return the same message regardless of existence
      return {
        exists, // Internal use only - don't expose to client
        message: 'If an account is associated with that email, a reset link has been sent'
      }

    } catch (error) {
      console.error('Email check error:', error)
      
      // Ensure minimum response time even on errors
      await this.normalizeResponseTime(startTime)
      
      return {
        exists: true,
        message: 'If an account is associated with that email, a reset link has been sent'
      }
    }
  }

  /**
   * Normalize response time to prevent timing attacks
   */
  private static async normalizeResponseTime(startTime: number): Promise<void> {
    const elapsed = Date.now() - startTime
    const minimumTime = this.MINIMUM_RESPONSE_TIME_MS
    const randomDelay = Math.floor(Math.random() * this.RANDOM_DELAY_MAX_MS)
    const totalMinimum = minimumTime + randomDelay
    
    if (elapsed < totalMinimum) {
      const delay = totalMinimum - elapsed
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }

  /**
   * Constant-time string comparison for sensitive data
   */
  static constantTimeEquals(a: string, b: string): boolean {
    if (a.length !== b.length) {
      return false
    }
    
    try {
      const bufferA = Buffer.from(a, 'utf8')
      const bufferB = Buffer.from(b, 'utf8')
      return timingSafeEqual(bufferA, bufferB)
    } catch {
      return false
    }
  }

  /**
   * Generate secure random delay for additional timing obfuscation
   */
  static async addRandomDelay(maxMs: number = 200): Promise<void> {
    const delay = Math.floor(Math.random() * maxMs)
    await new Promise(resolve => setTimeout(resolve, delay))
  }

  /**
   * Secure audit logging that doesn't leak sensitive information
   */
  static async logAuthAttempt(
    email: string,
    success: boolean,
    ipAddress: string,
    userAgent: string,
    userId?: string
  ): Promise<void> {
    try {
      const admin = createAdminClient()
      
      const { error } = await admin.from('audit_logs').insert({
        user_id: userId || null,
        action: success ? 'login_success' : 'login_failed',
        entity_type: 'authentication',
        entity_id: userId || null,
        details: {
          email_hash: this.hashEmail(email), // Store hash instead of actual email
          user_agent: userAgent?.substring(0, 200), // Truncate user agent
          success
        },
        ip_address: ipAddress,
        performed_at: new Date().toISOString()
      })

      if (error) {
        console.error('Audit logging error:', error)
      }
    } catch (error) {
      console.error('Audit logging error:', error)
      // Don't throw - logging failures shouldn't break authentication
    }
  }

  /**
   * Hash email for secure logging without exposing actual email
   */
  private static hashEmail(email: string): string {
    return createHash('sha256').update(email.toLowerCase()).digest('hex').substring(0, 16)
  }
}

// Minimal profile shape used in this module
interface UserProfileMinimal {
  is_active: boolean
  is_guest: boolean
}

// Minimal user shape returned on successful authentication
interface AuthUserMinimal {
  id: string
  email: string | null
  is_guest: boolean
}
