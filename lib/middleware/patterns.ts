import { NextRequest, NextResponse } from 'next/server'

/**
 * Middleware handler function type
 */
export type MiddlewareHandler = (
  request: NextRequest,
  response: NextResponse
) => Promise<NextResponse | void> | NextResponse | void

/**
 * Pattern configuration for route matching
 */
export interface RoutePattern {
  pattern: RegExp
  handler: MiddlewareHandler
  priority?: number
}

/**
 * Convert a path pattern to RegExp
 * Supports :param and :param* wildcards
 * @param pattern - Path pattern (e.g., '/dashboard/:path*')
 * @returns RegExp for matching
 */
export function patternToRegex(pattern: string): RegExp {
  let regexStr = pattern
  
  // Handle :param* wildcard FIRST (before escaping)
  // Matches :paramName* and replaces with placeholder
  regexStr = regexStr.replace(/:([a-zA-Z_][a-zA-Z0-9_]*)\*/g, '<<<WILDCARD>>>')
  
  // Handle :param single segment SECOND (before escaping)
  // Matches :paramName and replaces with placeholder
  regexStr = regexStr.replace(/:([a-zA-Z_][a-zA-Z0-9_]*)/g, '<<<SEGMENT>>>')
  
  // NOW escape special regex characters
  regexStr = regexStr
    .replace(/\./g, '\\.')
    .replace(/\//g, '\\/')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
    .replace(/\[/g, '\\[')
    .replace(/\]/g, '\\]')
    .replace(/\{/g, '\\{')
    .replace(/\}/g, '\\}')
    .replace(/\?/g, '\\?')
    .replace(/\+/g, '\\+')
    .replace(/\*/g, '\\*')
    .replace(/\^/g, '\\^')
    .replace(/\$/g, '\\$')
    .replace(/\|/g, '\\|')
  
  // Replace placeholders with actual regex patterns
  regexStr = regexStr.replace(/<<<WILDCARD>>>/g, '(?:.*)?')
  regexStr = regexStr.replace(/<<<SEGMENT>>>/g, '([^\\/]+)')
  
  // Ensure exact match from start to end
  return new RegExp(`^${regexStr}$`)
}

/**
 * Create a pattern matcher for routes
 * @param pathname - The pathname pattern to match (supports :param and :param* wildcards)
 * @returns RegExp pattern
 */
export function createPattern(pathname: string): RegExp {
  return patternToRegex(pathname)
}

/**
 * Match request against patterns and execute handlers
 * @param request - Next.js request
 * @param response - Next.js response
 * @param patterns - Array of route patterns to match
 * @returns Modified response or void
 */
export async function matchPatterns(
  request: NextRequest,
  response: NextResponse,
  patterns: RoutePattern[]
): Promise<NextResponse> {
  // Sort patterns by priority (higher priority first)
  const sortedPatterns = [...patterns].sort((a, b) => 
    (b.priority ?? 0) - (a.priority ?? 0)
  )

  const pathname = request.nextUrl.pathname

  for (const { pattern, handler } of sortedPatterns) {
    if (pattern.test(pathname)) {
      const result = await handler(request, response)
      if (result) {
        return result
      }
    }
  }

  return response
}

/**
 * Check if request matches a pattern
 * @param request - Next.js request
 * @param pathname - Pattern to match (supports :param and :param* wildcards)
 * @returns True if matches
 */
export function matchesPattern(request: NextRequest, pathname: string): boolean {
  const pattern = createPattern(pathname)
  return pattern.test(request.nextUrl.pathname)
}

/**
 * Common route patterns for PromptOK
 */
export const RoutePatterns = {
  // Dashboard routes
  dashboard: createPattern('/dashboard/:path*'),
  
  // Auth routes
  authAll: createPattern('/auth/:path*'),
  authSignin: createPattern('/auth/signin'),
  authCallback: createPattern('/auth/callback'),
  authResetConfirm: createPattern('/auth/reset-password-confirm'),
  
  // Admin routes
  adminAll: createPattern('/admin/:path*'),
  
  // Tools routes
  toolsAll: createPattern('/tools/:path*'),
  toolsEnhance: createPattern('/tools/enhance'),
  
  // API routes
  apiAll: createPattern('/api/:path*'),
  
  // Public routes
  home: createPattern('/'),
  pricing: createPattern('/pricing'),
  
  // Static assets (to exclude)
  nextStatic: createPattern('/_next/static/:path*'),
  nextImage: createPattern('/_next/image/:path*'),
} as const
