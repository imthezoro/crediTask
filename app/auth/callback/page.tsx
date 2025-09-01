'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase-client'
import { useRouter, useSearchParams } from 'next/navigation'
import { AuthErrors, getAuthErrorDetails, createErrorUrl } from '@/lib/auth-errors'

export default function AuthCallbackPage() {
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        const { data, error } = await supabase.auth.getSession()
        
        if (error) {
          console.error('Auth callback error:', error)
          router.push(createErrorUrl('/auth/signin', AuthErrors.GENERIC_AUTH_ERROR))
          return
        }

        if (data.session) {
          // Use secure profile validation API
          const response = await fetch('/api/auth/validate-session', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ userId: data.session.user.id }),
          })

          const result = await response.json()

          if (!response.ok || !result.isValid) {
            await supabase.auth.signOut()
            
            // Check if account is blocked and show specific message
            if (result.isBlocked && result.blockedUntil) {
              const blockedUntilDate = new Date(result.blockedUntil)
              const daysRemaining = Math.max(1, Math.ceil((blockedUntilDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
              const hoursRemaining = Math.max(1, Math.ceil((blockedUntilDate.getTime() - Date.now()) / (1000 * 60 * 60)))
              
              let timeMessage = ''
              if (daysRemaining > 1) {
                timeMessage = `${daysRemaining} days`
              } else {
                timeMessage = `${hoursRemaining} hours`
              }
              
              const blockMessage = `This email is blocked due to account deletion. Please wait ${timeMessage} before creating a new account, or contact support.`
              router.push(createErrorUrl('/auth/signin', AuthErrors.GENERIC_AUTH_ERROR, blockMessage))
              return
            }
            
            // All other validation failures return generic error
            router.push(createErrorUrl('/auth/signin', AuthErrors.GENERIC_AUTH_ERROR))
            return
          }

          router.push('/dashboard')
        } else {
          router.push('/auth/signin')
        }
      } catch (error) {
        console.error('Unexpected error:', error)
        router.push(createErrorUrl('/auth/signin', AuthErrors.GENERIC_AUTH_ERROR))
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
