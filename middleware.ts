import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { profileCache } from '@/lib/profile-cache'

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
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Check if user is authenticated
  const { data: { user } } = await supabase.auth.getUser()

  // Redirect unauthenticated users to signin for protected routes
  if (!user && request.nextUrl.pathname.startsWith('/dashboard')) {
    return NextResponse.redirect(new URL('/auth/signin', request.url))
  }

  // Check if authenticated user has active profile for protected routes
  if (user && request.nextUrl.pathname.startsWith('/dashboard')) {
    // Try cache first
    let isActive = profileCache.get(user.id)
    
    if (isActive === null) {
      // Cache miss - query database
      const { data: profile, error } = await supabase
        .from('user_profiles')
        .select('is_active')
        .eq('id', user.id)
        .single()

      if (error) {
        // Database error - sign out for security
        await supabase.auth.signOut()
        return NextResponse.redirect(new URL('/auth/signin?error=Account verification failed', request.url))
      }

      isActive = Boolean(profile?.is_active)
      // Cache the result
      profileCache.set(user.id, isActive)
    }

    if (!isActive) {
      // Sign out inactive users
      await supabase.auth.signOut()
      profileCache.invalidate(user.id) // Clear cache for inactive user
      return NextResponse.redirect(new URL('/auth/signin?error=Account is not active', request.url))
    }
  }

  // Redirect authenticated users away from auth pages
  if (user && request.nextUrl.pathname.startsWith('/auth/')) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return response
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
