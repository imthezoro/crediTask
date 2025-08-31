'use client'

import { useEffect } from 'react'
import { createClient } from '@/lib/supabase-client'
import { useRouter } from 'next/navigation'
import { AuthErrors, createErrorUrl } from '@/lib/auth-errors'

export default function AuthCallbackPage() {
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        const { data, error } = await supabase.auth.getSession()
        
        if (error) {
          console.error('Auth callback error:', error)
          router.push(createErrorUrl('/auth/signin', AuthErrors.AUTHENTICATION_FAILED))
          return
        }

        if (data.session) {
          // Check if user profile is active
          const { data: profile, error: profileError } = await supabase
            .from('user_profiles')
            .select('is_active')
            .eq('id', data.session.user.id)
            .single()

          if (profileError || !profile?.is_active) {
            await supabase.auth.signOut()
            router.push(createErrorUrl('/auth/signin', AuthErrors.ACCOUNT_DEACTIVATED))
            return
          }

          router.push('/dashboard')
        } else {
          router.push('/auth/signin')
        }
      } catch (error) {
        console.error('Unexpected error:', error)
        router.push(createErrorUrl('/auth/signin', AuthErrors.AUTHENTICATION_FAILED))
      }
    }

    handleAuthCallback()
  }, [router, supabase])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Completing authentication...</p>
      </div>
    </div>
  )
}
