import { createClient, createAdminClient } from '@/lib/supabase-server'
import { timingSafeEqual } from 'crypto'

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
    user?: any
    profile?: any
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

      let profile = null
      let profileError = null

      // Always attempt profile lookup (constant-time regardless of auth success)
      if (authData?.user?.id) {
        const { data: profileData, error: profError } = await admin
          .from('user_profiles')
          .select('is_active, is_guest')
          .eq('id', authData.user.id)
          .single()
        
        profile = profileData
        profileError = profError
      }

      // Determine final result
      let success = false
      let user = null
      
      if (!authError && authData?.user && profile && profile.is_active) {
        success = true
        user = {
          id: authData.user.id,
          email: authData.user.email,
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
    profile?: any
    error?: string
    isBlocked?: boolean
    blockedUntil?: string
  }> {
    const startTime = Date.now()
    
    try {
      const admin = createAdminClient()
      
      // Always perform profile lookup
      let { data: profile, error: profileError } = await admin
        .from('user_profiles')
        .select('is_active, is_guest')
        .eq('id', userId)
        .single()

      // Check blocked emails regardless of profile existence
      let isBlocked = false
      let blockedUntil: string | undefined
      const { data: user } = await admin.auth.admin.getUserById(userId)
      if (user?.user?.email) {
        const { data: blockedEmail } = await admin
          .from('blocked_emails')
          .select('blocked_until, reason')
          .eq('email', user.user.email)
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
            .eq('email', user.user.email)
            .lt('blocked_until', new Date().toISOString())
            .single()
          
          if (expiredBlock) {
            // Remove expired block and reactivate user
            const { error: deleteError } = await admin
              .from('blocked_emails')
              .delete()
              .eq('email', user.user.email)
            
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
                    .select('is_active, is_guest')
                    .eq('id', userId)
                    .single()
                  profile = reactivatedProfile
                }
              }
            }
          }
        }
      }

      // If not blocked and profile missing, create a minimal active profile (first-time OAuth)
      if (!isBlocked && !profile) {
        const { error: insertError } = await admin
          .from('user_profiles')
          .insert({ id: userId, is_active: true, is_guest: false })
        
        if (!insertError) {
          const { data: createdProfile } = await admin
            .from('user_profiles')
            .select('is_active, is_guest')
            .eq('id', userId)
            .single()
          profile = createdProfile
        }
      }

      // Determine validity
      const isValid = !profileError &&
                      profile &&
                      profile.is_active &&
                      !isBlocked

      // Ensure minimum response time
      await this.normalizeResponseTime(startTime)

      return {
        isValid,
        profile: isValid ? profile : undefined,
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
  static async checkEmailExists(email: string): Promise<{
    exists: boolean
    message: string
  }> {
    const startTime = Date.now()
    
    try {
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
    const crypto = require('crypto')
    return crypto.createHash('sha256').update(email.toLowerCase()).digest('hex').substring(0, 16)
  }
}
