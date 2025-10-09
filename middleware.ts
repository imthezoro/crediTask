import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createCsrfProtect, CsrfError } from '@edge-csrf/nextjs'
import { addSecurityHeaders } from '@/lib/security'
import { generateCorrelationId } from '@/lib/correlation'
import { appConfig } from './lib/config'
import { 
  matchesPattern,
  handleDashboardRoute,
  handleAuthRoute,
  handleAdminRoute
} from './lib/middleware'

const CSRF_SECRET_COOKIE = 'csrfSecret'
const NEXT_ACTION_HEADER = 'next-action'

// Helper to check if request is a server action
function isServerAction(request: NextRequest): boolean {
  return request.headers.has(NEXT_ACTION_HEADER)
}


export async function middleware(request: NextRequest) {
  // Generate correlation ID for request tracing
  const correlationId = request.headers.get('x-correlation-id') || generateCorrelationId()
  
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })
  
  // Add correlation ID to response headers
  response.headers.set('x-correlation-id', correlationId)

  // Apply CSRF protection for mutating requests
  const csrfProtect = createCsrfProtect({
    cookie: {
      secure: appConfig.production,
      name: CSRF_SECRET_COOKIE,
    },
    // Ignore CSRF errors for server actions since Next.js has built-in protection
    // Always ignore GET, HEAD, and OPTIONS requests
    ignoreMethods: isServerAction(request)
      ? ['POST']
      : ['GET', 'HEAD', 'OPTIONS'],
  })

  try {
    await csrfProtect(request, response)
  } catch (error) {
    // If there is a CSRF error, return a 403 response
    if (error instanceof CsrfError) {
      console.error('CSRF token validation failed:', error.message)
      return NextResponse.json(
        { error: 'Invalid CSRF token. Please refresh the page and try again.' },
        { status: 403 }
      )
    }
    // Re-throw other errors
    throw error
  }

  const supabase = createServerClient(
    appConfig.supabase.url,
    appConfig.supabase.anonKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options)
          })
        },
      },
    }
  )

  // Check if user is authenticated
  const { data: { user } } = await supabase.auth.getUser()

  // Handle dashboard routes using pattern matching
  if (matchesPattern(request, '/dashboard/:path*')) {
    const result = await handleDashboardRoute(request, response, supabase, user)
    if (result) return result
  }

  // Handle admin routes using pattern matching
  if (matchesPattern(request, '/admin/:path*')) {
    const result = await handleAdminRoute(request, response, supabase, user)
    if (result) return result
  }

  // Handle auth routes using pattern matching
  if (matchesPattern(request, '/auth/:path*')) {
    const result = await handleAuthRoute(request, response, supabase, user)
    if (result) return result
  }

  return addSecurityHeaders(response)
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     * - api routes (handled separately)
     * - extension-auth/bridge (handled by route.ts with custom headers)
     */
    '/((?!_next/static|_next/image|favicon.ico|api/|extension-auth/bridge|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
