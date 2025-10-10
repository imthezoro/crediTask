import { createLogger } from './logger'
import { LogContext } from './types'

/**
 * Middleware Logger for logging middleware operations
 */
export class MiddlewareLogger {
  private logger = createLogger({ prefix: 'Middleware' })

  /**
   * Log route protection check
   */
  logProtection(route: string, authenticated: boolean, context?: LogContext): void {
    this.logger.debug(`Route protection check: ${route}`, {
      route,
      authenticated,
      ...context,
    })
  }

  /**
   * Log redirect
   */
  logRedirect(from: string, to: string, reason: string, context?: LogContext): void {
    this.logger.info(`Redirecting user`, {
      from,
      to,
      reason,
      ...context,
    })
  }

  /**
   * Log authentication check
   */
  logAuthCheck(userId: string | null, isActive: boolean, context?: LogContext): void {
    this.logger.debug('Auth check completed', {
      userId: userId || 'anonymous',
      isActive,
      ...context,
    })
  }

  /**
   * Log admin access check
   */
  logAdminCheck(userId: string, isAdmin: boolean, context?: LogContext): void {
    this.logger.info('Admin access check', {
      userId,
      isAdmin,
      granted: isAdmin,
      ...context,
    })
  }

  /**
   * Log middleware error
   */
  logError(error: Error | unknown, path: string, context?: LogContext): void {
    this.logger.error('Middleware error', {
      error,
      path,
      errorMessage: error instanceof Error ? error.message : String(error),
      ...context,
    })
  }
}

/**
 * Global middleware logger instance
 */
export const middlewareLogger = new MiddlewareLogger()
