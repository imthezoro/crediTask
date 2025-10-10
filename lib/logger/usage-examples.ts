/**
 * Logger Usage Examples
 * Demonstrates how to use the structured logger throughout the application
 */

import { logger, createLogger, createApiLogger, LogLevel } from './index'

// ============================================
// Example 1: Basic Logging
// ============================================

export function exampleBasicLogging() {
  // Debug level (only in development)
  logger.debug('Debugging information', { 
    variable: 'value',
    data: { nested: 'object' }
  })

  // Info level
  logger.info('User logged in', { 
    userId: '123',
    email: 'user@example.com'
  })

  // Warning level
  logger.warn('API rate limit approaching', { 
    userId: '123',
    currentRate: 95,
    limit: 100
  })

  // Error level
  logger.error('Failed to process payment', { 
    userId: '123',
    error: new Error('Payment gateway timeout'),
    orderId: 'order-456'
  })
}

// ============================================
// Example 2: Creating Child Loggers
// ============================================

export function exampleChildLoggers() {
  // Create domain-specific loggers
  const authLogger = logger.child('Auth')
  const paymentLogger = logger.child('Payment')
  
  authLogger.info('User authenticated', { userId: '123' })
  // Output: [PromptOK:Auth] User authenticated

  paymentLogger.info('Payment processed', { amount: 1000 })
  // Output: [PromptOK:Payment] Payment processed
}

// ============================================
// Example 3: API Route Logging
// ============================================

import { NextRequest } from 'next/server'

export async function exampleApiRouteLogging(request: NextRequest) {
  const apiLogger = createApiLogger('users')

  // Wrap your API handler
  return await apiLogger.withLogging(
    request,
    async () => {
      // Your API logic here
      const users = await fetchUsers()
      return Response.json({ users })
    },
    { userId: 'admin-123', requestId: 'req-abc' }
  )
  
  // Automatically logs:
  // - Incoming request with method, path, query params
  // - Response with status code and duration
  // - Errors if any occur
}

// ============================================
// Example 4: Manual API Logging
// ============================================

export async function exampleManualApiLogging(request: NextRequest) {
  const apiLogger = createApiLogger('payments')
  const startTime = Date.now()

  try {
    // Log request
    apiLogger.logRequest(request, { userId: '123' })

    // Your logic
    const result = await processPayment()
    const duration = Date.now() - startTime

    // Log success
    apiLogger.logResponse(200, duration, { 
      userId: '123',
      paymentId: result.id
    })

    return Response.json(result)
  } catch (error) {
    const duration = Date.now() - startTime
    
    // Log error
    apiLogger.logError(error, 500, { 
      userId: '123',
      duration
    })

    return Response.json({ error: 'Payment failed' }, { status: 500 })
  }
}

// ============================================
// Example 5: Custom Logger Configuration
// ============================================

export function exampleCustomLogger() {
  // Development logger (verbose)
  const devLogger = createLogger({
    prefix: 'Dev',
    minLevel: LogLevel.DEBUG,
    enableConsole: true,
    enableRemote: false,
  })

  // Production logger (quiet)
  const prodLogger = createLogger({
    prefix: 'Prod',
    minLevel: LogLevel.WARN,
    enableConsole: true,
    enableRemote: true,
  })

  devLogger.debug('This will show in dev')
  prodLogger.debug('This will NOT show in prod')
}

// Placeholder functions for examples
async function fetchUsers() { return [] }
async function processPayment() { return { id: 'pay-123' } }
