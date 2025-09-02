import { createServerClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { profileCache } from './lib/profile-cache'
import { addSecurityHeaders } from './lib/security-middleware'
import { AuthErrors, createErrorUrl } from './lib/auth-errors'

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

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          // Don't recreate response here - just set cookies on existing response
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
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

  // Handle auth routes - redirect authenticated active users to dashboard
  // Exception: Allow access to reset-password-confirm for password reset flow
  if (user && request.nextUrl.pathname.startsWith('/auth/')) {
    
    const { isActive } = await checkUserProfile(supabase, user.id)

    if (isActive) {
      // Allow access to password reset confirmation page
      if (request.nextUrl.pathname === '/auth/reset-password-confirm') {
        return addSecurityHeaders(response)
      }
      const redirectResponse = NextResponse.redirect(new URL('/dashboard', request.url))
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
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
