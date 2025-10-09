import { headers } from 'next/headers'
import { NextRequest } from 'next/server'

/**
 * Generate a unique correlation ID
 */
export function generateCorrelationId(): string {
  const timestamp = Date.now().toString(36)
  const random = Math.random().toString(36).substring(2, 11)
  return `req_${timestamp}_${random}`
}

/**
 * Get correlation ID from request headers
 */
export function getCorrelationId(request: NextRequest): string {
  return request.headers.get('x-correlation-id') || generateCorrelationId()
}

/**
 * Get correlation ID from server component headers
 */
export function getCorrelationIdFromHeaders(): string {
  const headersList = headers()
  return headersList.get('x-correlation-id') || generateCorrelationId()
}

/**
 * Set correlation ID in response headers
 */
export function setCorrelationIdHeader(
  response: Response,
  correlationId: string
): Response {
  response.headers.set('x-correlation-id', correlationId)
  return response
}

/**
 * Correlation ID Header Name
 */
export const CORRELATION_ID_HEADER = 'x-correlation-id'
