import { NextRequest } from 'next/server';

/**
 * SECURITY: Allowed origins for CORS
 * Only these origins can make authenticated requests
 */
const getAllowedOrigins = (): string[] => {
  const origins = [
    'http://localhost:3000',
    'http://127.0.0.1:3000',
  ];
  
  // Add production URL if configured
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (siteUrl && !siteUrl.includes('localhost')) {
    origins.push(siteUrl);
  }
  
  return origins;
};

/**
 * SECURITY: Check if origin is allowed
 * Supports browser extensions and whitelisted web origins
 */
function isOriginAllowed(origin: string | null): boolean {
  if (!origin) return false;
  
  // Allow browser extensions
  if (origin.startsWith('chrome-extension://') || origin.startsWith('moz-extension://')) {
    return true;
  }
  
  // Check against whitelist
  return getAllowedOrigins().includes(origin);
}

/**
 * DEPRECATED: Use getCorsHeaders instead
 * Kept for backward compatibility but should not be used with credentials
 */
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Extension-Token',
};

/**
 * Generate CORS headers based on request origin
 * SECURITY: Implements proper origin validation
 */
export function getCorsHeaders(request?: NextRequest): Record<string, string> {
  const origin = request?.headers.get('origin');
  const isAllowed = origin && isOriginAllowed(origin);
  
  return {
    'Access-Control-Allow-Origin': isAllowed ? origin : 'null',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Extension-Token',
    'Access-Control-Allow-Credentials': isAllowed ? 'true' : 'false',
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


