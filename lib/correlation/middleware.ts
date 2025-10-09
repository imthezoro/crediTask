import { NextRequest, NextResponse } from 'next/server'
import { generateCorrelationId, setCorrelationIdHeader } from './correlation-id'

/**
 * Middleware to add correlation ID to requests
 */
export function withCorrelationId(
  request: NextRequest,
  response: NextResponse
): NextResponse {
  // Get existing correlation ID or generate new one
  let correlationId = request.headers.get('x-correlation-id')
  
  if (!correlationId) {
    correlationId = generateCorrelationId()
  }

  // Create new response with correlation ID header
  const newResponse = NextResponse.next({
    request: {
      headers: new Headers(request.headers),
    },
  })

  // Set correlation ID in response headers
  newResponse.headers.set('x-correlation-id', correlationId)

  // Copy all other headers from original response
  response.headers.forEach((value, key) => {
    newResponse.headers.set(key, value)
  })

  return newResponse
}

/**
 * Add correlation ID to existing response
 */
export function addCorrelationIdToResponse(
  response: NextResponse,
  correlationId: string
): NextResponse {
  response.headers.set('x-correlation-id', correlationId)
  return response
}
