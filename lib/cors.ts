import { NextRequest } from 'next/server';

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

/**
 * Generate CORS headers based on request origin
 * Handles extension requests with credentials properly
 */
export function getCorsHeaders(request?: NextRequest): Record<string, string> {
  const origin = request?.headers.get('origin');
  const isExtension = origin?.startsWith('chrome-extension://') || origin?.startsWith('moz-extension://');
  
  return {
    'Access-Control-Allow-Origin': isExtension ? (origin || '*') : '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Credentials': isExtension ? 'true' : 'false',
    'Access-Control-Max-Age': '86400',
  };
}

export function corsJson(data: unknown, init?: ResponseInit, request?: NextRequest) {
  const headers = request ? getCorsHeaders(request) : corsHeaders;
  return new Response(JSON.stringify(data), {
    ...(init || {}),
    headers: { 'Content-Type': 'application/json', ...(init?.headers || {}), ...headers },
  });
}

export function corsEmpty(status = 204, request?: NextRequest) {
  const headers = request ? getCorsHeaders(request) : corsHeaders;
  return new Response(null, { status, headers: { ...headers } });
}

/**
 * Create NextResponse with proper CORS headers
 */
export function createCorsResponse(data: unknown, status = 200, request?: NextRequest) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...getCorsHeaders(request) }
  });
}


