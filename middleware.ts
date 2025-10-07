import { createServerClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { CsrfError, createCsrfProtect } from '@edge-csrf/nextjs'
import { profileCache } from './lib/cache'
import { addSecurityHeaders } from './lib/security'
import { AuthErrors, createErrorUrl } from './features/auth'
import { appConfig } from './lib/config'

const CSRF_SECRET_COOKIE = 'csrfSecret'
const NEXT_ACTION_HEADER = 'next-action'

// Helper to check if request is a server action
function isServerAction(request: NextRequest): boolean {
  return request.headers.has(NEXT_ACTION_HEADER)
}

// Helper function to check user profile status with caching
async function checkUserProfile(supabase: SupabaseClient, userId: string) {
  // Try cache first
  let isActive = profileCache.get(userId)
  
  if (isActive === null) {
    // Cache miss - query database
    const { data: profile, error } = await supabase
      .from('user_profiles')
      .select('is_active')
      .eq('id', userId)
      .single()

    if (error) {
      console.error('Profile check error:', error)
      return { isActive: false, hasError: true }
    }

    isActive = Boolean(profile?.is_active)
    // Cache the result
    profileCache.set(userId, isActive)
  }

  return { isActive, hasError: false }
}

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

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

  // Handle dashboard routes
  if (request.nextUrl.pathname.startsWith('/dashboard')) {
    if (!user) {
      const redirectResponse = NextResponse.redirect(new URL('/auth/signin', request.url))
      return addSecurityHeaders(redirectResponse)
    }

    // Check if authenticated user has active profile
    const { isActive, hasError } = await checkUserProfile(supabase, user.id)

    if (hasError) {
      // Database error - sign out for security and clear cache
      await supabase.auth.signOut()
      profileCache.invalidate(user.id)
      const redirectResponse = NextResponse.redirect(
        new URL(createErrorUrl('/auth/signin', AuthErrors.ACCOUNT_VERIFICATION_FAILED), request.url)
      )
      // Copy auth cookies to redirect response
      response.cookies.getAll().forEach((cookie) => {
        redirectResponse.cookies.set(cookie.name, cookie.value, cookie)
      })
      return addSecurityHeaders(redirectResponse)
    }

    if (!isActive) {
      // Sign out inactive users
      await supabase.auth.signOut()
      profileCache.invalidate(user.id)
      const redirectResponse = NextResponse.redirect(
        new URL(createErrorUrl('/auth/signin', AuthErrors.ACCOUNT_DEACTIVATED), request.url)
      )
      // Copy auth cookies to redirect response
      response.cookies.getAll().forEach((cookie) => {
        redirectResponse.cookies.set(cookie.name, cookie.value, cookie)
      })
      return addSecurityHeaders(redirectResponse)
    }
  }

  // Handle auth routes - redirect authenticated active users to enhance page
  // Exception: Allow access to reset-password-confirm for password reset flow
  if (user && request.nextUrl.pathname.startsWith('/auth/')) {
    // Skip profile check for callback and reset pages (they handle their own validation)
    if (request.nextUrl.pathname === '/auth/callback' || 
        request.nextUrl.pathname === '/auth/reset-password-confirm') {
      return addSecurityHeaders(response)
    }
    
    const { isActive } = await checkUserProfile(supabase, user.id)

    if (isActive) {
      const redirectResponse = NextResponse.redirect(new URL('/tools/enhance', request.url))
      // Copy cookies to redirect response
      response.cookies.getAll().forEach((cookie) => {
        redirectResponse.cookies.set(cookie.name, cookie.value, cookie)
      })
      return addSecurityHeaders(redirectResponse)
    }
    // If not active, allow access to auth pages (no redirect)
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
