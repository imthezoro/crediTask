import { NextRequest, NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { profileCache } from '../cache'
import { addSecurityHeaders } from '../security'
import { AuthErrors, createErrorUrl } from '@/features/auth'
import { middlewareLogger } from '../logger'

/**
 * Helper function to check user profile status with caching
 */
export async function checkUserProfile(supabase: SupabaseClient, userId: string) {
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
      middlewareLogger.logError(error, 'profile-check', { userId })
      return { isActive: false, hasError: true }
    }

    isActive = Boolean(profile?.is_active)
    // Cache the result
    profileCache.set(userId, isActive)
  }

  return { isActive, hasError: false }
}

/**
 * Handler for dashboard routes
 * Ensures user is authenticated and has active profile
 */
export async function handleDashboardRoute(
  request: NextRequest,
  response: NextResponse,
  supabase: SupabaseClient,
  user: any
): Promise<NextResponse | void> {
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

  // User is authenticated and active - allow access
  return undefined
}

/**
 * Handler for auth routes
 * Redirects authenticated active users to enhance page
 * Exception: callback and reset-password-confirm pages
 */
export async function handleAuthRoute(
  request: NextRequest,
  response: NextResponse,
  supabase: SupabaseClient,
  user: any
): Promise<NextResponse | void> {
  if (!user) {
    // Not authenticated - allow access to auth pages
    return undefined
  }

  // Skip profile check for callback and reset pages (they handle their own validation)
  if (
    request.nextUrl.pathname === '/auth/callback' || 
    request.nextUrl.pathname === '/auth/reset-password-confirm'
  ) {
    return undefined
  }
  
  const { isActive } = await checkUserProfile(supabase, user.id)

  if (isActive) {
    // Authenticated and active - redirect to enhance page
    const redirectResponse = NextResponse.redirect(new URL('/tools/enhance', request.url))
    // Copy cookies to redirect response
    response.cookies.getAll().forEach((cookie) => {
      redirectResponse.cookies.set(cookie.name, cookie.value, cookie)
    })
    return addSecurityHeaders(redirectResponse)
  }
  
  // If not active, allow access to auth pages (no redirect)
  return undefined
}

/**
 * Handler for admin routes
 * Ensures user is authenticated, has active profile, and is admin
 */
export async function handleAdminRoute(
  request: NextRequest,
  response: NextResponse,
  supabase: SupabaseClient,
  user: any
): Promise<NextResponse | void> {
  if (!user) {
    const redirectResponse = NextResponse.redirect(new URL('/auth/signin', request.url))
    return addSecurityHeaders(redirectResponse)
  }

  // Check if authenticated user has active profile and is admin
  const { isActive } = await checkUserProfile(supabase, user.id)

  if (!isActive) {
    await supabase.auth.signOut()
    profileCache.invalidate(user.id)
    const redirectResponse = NextResponse.redirect(
      new URL(createErrorUrl('/auth/signin', AuthErrors.ACCOUNT_DEACTIVATED), request.url)
    )
    response.cookies.getAll().forEach((cookie) => {
      redirectResponse.cookies.set(cookie.name, cookie.value, cookie)
    })
    return addSecurityHeaders(redirectResponse)
  }

  // Check if user is admin (using is_admin boolean column)
  const { data: profile, error: adminError } = await supabase
    .from('user_profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single()

  if (adminError) {
    middlewareLogger.logError(adminError, request.nextUrl.pathname, { userId: user.id })
  }

  middlewareLogger.logAdminCheck(user.id, Boolean(profile?.is_admin), {
    path: request.nextUrl.pathname,
  })

  if (!profile?.is_admin) {
    middlewareLogger.logRedirect(
      request.nextUrl.pathname,
      '/dashboard',
      'User is not admin',
      { userId: user.id }
    )
    const redirectResponse = NextResponse.redirect(new URL('/dashboard', request.url))
    return addSecurityHeaders(redirectResponse)
  }

  // User is admin - allow access
  return undefined
}
