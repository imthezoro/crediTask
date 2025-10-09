import { NextRequest, NextResponse } from 'next/server'
import { Logger, createLogger } from './logger'
import { LogContext } from './types'

/**
 * API Logger for logging API requests and responses
 */
export class ApiLogger {
  private logger: Logger

  constructor(routeName: string) {
    this.logger = createLogger({ prefix: `API:${routeName}` })
  }

  /**
   * Log incoming request
   */
  logRequest(request: NextRequest, context?: LogContext): void {
    this.logger.info('Incoming request', {
      method: request.method,
      path: request.nextUrl.pathname,
      query: Object.fromEntries(request.nextUrl.searchParams),
      headers: {
        'user-agent': request.headers.get('user-agent'),
        'content-type': request.headers.get('content-type'),
      },
      ...context,
    })
  }

  /**
   * Log successful response
   */
  logResponse(statusCode: number, duration: number, context?: LogContext): void {
    this.logger.info('Request completed', {
      statusCode,
      duration,
      ...context,
    })
  }

  /**
   * Log error response
   */
  logError(error: Error | unknown, statusCode: number, context?: LogContext): void {
    this.logger.error('Request failed', {
      error,
      statusCode,
      errorMessage: error instanceof Error ? error.message : String(error),
      errorStack: error instanceof Error ? error.stack : undefined,
      ...context,
    })
  }

  /**
   * Middleware wrapper for API routes
   */
  async withLogging<T>(
    request: NextRequest,
    handler: () => Promise<T>,
    options?: { userId?: string; requestId?: string }
  ): Promise<T> {
    const startTime = Date.now()

    this.logRequest(request, options)

    try {
      const result = await handler()
      const duration = Date.now() - startTime

      // Extract status code if result is NextResponse
      const statusCode = result instanceof NextResponse ? result.status : 200

      this.logResponse(statusCode, duration, options)

      return result
    } catch (error) {
      const duration = Date.now() - startTime
      this.logError(error, 500, { ...options, duration })
      throw error
    }
  }
}

/**
 * Create an API logger instance
 */
export function createApiLogger(routeName: string): ApiLogger {
  return new ApiLogger(routeName)
}
