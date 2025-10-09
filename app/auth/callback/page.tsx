'use client'

import { useEffect, Suspense } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useSearchParams } from 'next/navigation'
import { createAuthCallbackService } from '@/lib/auth/callback-service'

// Auth pages need dynamic behavior for redirects and error handling
export const dynamic = 'force-dynamic'

function AuthCallbackContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()

  useEffect(() => {
    const handleAuthCallback = async () => {
      // Get auth code from URL params (PKCE flow)
      const code = searchParams?.get('code')
      
      // Use centralized callback service
      const callbackService = createAuthCallbackService(supabase)
      const result = await callbackService.handleCallback(code)
      
      // Redirect based on result
      router.push(result.redirectUrl)
    }

    handleAuthCallback()
  }, [router, supabase, searchParams])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Completing authentication...</p>
      </div>
    </div>
  )
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <AuthCallbackContent />
    </Suspense>
  )
}
