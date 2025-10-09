import { SupabaseClient } from '@supabase/supabase-js'
import { AuthErrors, createErrorUrl } from '@/features/auth'
import { createLogger } from '../logger'

const logger = createLogger({ prefix: 'AuthCallback' })

/**
 * Auth Callback Result
 */
export interface CallbackResult {
  success: boolean
  redirectUrl: string
  error?: string
}

/**
 * Session Validation Result
 */
interface SessionValidationResult {
  isValid: boolean
  isBlocked?: boolean
  blockedUntil?: string
  error?: string
}

/**
 * Auth Callback Service
 * Centralizes OAuth callback handling logic
 */
export class AuthCallbackService {
  constructor(private supabase: SupabaseClient) {}

  /**
   * Handle OAuth callback with PKCE code exchange
   */
  async handleCallback(code?: string | null): Promise<CallbackResult> {
    try {
      // 1. Try PKCE code exchange first
      if (code) {
        logger.info('Processing PKCE code exchange')
        return await this.handlePKCEFlow(code)
      }

      // 2. Fallback to existing session
      logger.info('Checking existing session')
      return await this.handleExistingSession()
    } catch (error) {
      logger.error('Unexpected callback error', { error })
      return {
        success: false,
        redirectUrl: createErrorUrl('/auth/signin', AuthErrors.GENERIC_AUTH_ERROR),
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  /**
   * Handle PKCE authorization code flow
   */
  private async handlePKCEFlow(code: string): Promise<CallbackResult> {
    const { data, error } = await this.supabase.auth.exchangeCodeForSession(code)

    if (error) {
      logger.error('Code exchange failed', { error })
      return {
        success: false,
        redirectUrl: createErrorUrl('/auth/signin', AuthErrors.GENERIC_AUTH_ERROR),
        error: error.message,
      }
    }

    if (!data.session) {
      logger.warn('No session after code exchange')
      return {
        success: false,
        redirectUrl: '/auth/signin',
      }
    }

    // Validate the session
    return await this.validateAndRedirect(data.session.user.id)
  }

  /**
   * Handle existing session validation
   */
  private async handleExistingSession(): Promise<CallbackResult> {
    const { data, error } = await this.supabase.auth.getSession()

    if (error) {
      logger.error('Session check failed', { error })
      return {
        success: false,
        redirectUrl: createErrorUrl('/auth/signin', AuthErrors.GENERIC_AUTH_ERROR),
        error: error.message,
      }
    }

    if (!data.session) {
      logger.info('No existing session found')
      return {
        success: false,
        redirectUrl: '/auth/signin',
      }
    }

    return await this.validateAndRedirect(data.session.user.id)
  }

  /**
   * Validate session and determine redirect
   */
  private async validateAndRedirect(userId: string): Promise<CallbackResult> {
    const validation = await this.validateSession(userId)

    if (!validation.isValid) {
      // Sign out invalid session
      await this.supabase.auth.signOut()
      logger.warn('Session validation failed', { userId })

      // Handle blocked accounts
      if (validation.isBlocked && validation.blockedUntil) {
        const blockMessage = this.formatBlockMessage(validation.blockedUntil)
        return {
          success: false,
          redirectUrl: createErrorUrl('/auth/signin', AuthErrors.GENERIC_AUTH_ERROR, blockMessage),
          error: blockMessage,
        }
      }

      // Generic validation failure
      return {
        success: false,
        redirectUrl: createErrorUrl('/auth/signin', AuthErrors.GENERIC_AUTH_ERROR),
        error: 'Session validation failed',
      }
    }

    // Success - redirect to app
    logger.info('Authentication successful', { userId })
    return {
      success: true,
      redirectUrl: '/tools/enhance',
    }
  }

  /**
   * Validate session via API
   */
  private async validateSession(userId: string): Promise<SessionValidationResult> {
    try {
      const response = await fetch('/api/auth/validate-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      })

      const result = await response.json()

      if (!response.ok) {
        return {
          isValid: false,
          error: result.error || 'Validation request failed',
        }
      }

      return {
        isValid: result.isValid || false,
        isBlocked: result.isBlocked,
        blockedUntil: result.blockedUntil,
      }
    } catch (error) {
      logger.error('Validation API error', { error, userId })
      return {
        isValid: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  /**
   * Format block message with time remaining
   */
  private formatBlockMessage(blockedUntil: string): string {
    const blockedDate = new Date(blockedUntil)
    const now = Date.now()
    const msRemaining = blockedDate.getTime() - now

    const daysRemaining = Math.max(1, Math.ceil(msRemaining / (1000 * 60 * 60 * 24)))
    const hoursRemaining = Math.max(1, Math.ceil(msRemaining / (1000 * 60 * 60)))

    const timeMessage = daysRemaining > 1 
      ? `${daysRemaining} days` 
      : `${hoursRemaining} hours`

    return `This email is blocked due to account deletion. Please wait ${timeMessage} before creating a new account, or contact support.`
  }
}

/**
 * Create auth callback service instance
 */
export function createAuthCallbackService(supabase: SupabaseClient): AuthCallbackService {
  return new AuthCallbackService(supabase)
}
