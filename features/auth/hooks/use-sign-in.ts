'use client'

import { useMutation } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { pathsConfig, authConfig } from '@/lib/config'

interface SignInCredentials {
  email: string
  password: string
}

interface SignInResponse {
  success: boolean
  message?: string
  error?: string
  user?: {
    id: string
    email: string
  }
}

/**
 * Hook for email/password sign in
 * Replaces manual fetch + useState pattern with React Query
 * Based on reference: nextjs-saas-starter-kit-lite useSignInWithEmailPassword
 */
export function useSignIn() {
  const router = useRouter()

  return useMutation({
    mutationKey: ['auth', 'sign-in'],
    mutationFn: async (credentials: SignInCredentials): Promise<SignInResponse> => {
      const response = await fetch(pathsConfig.api.auth.login, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(credentials),
      })

      const result = await response.json()

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Invalid email or password')
      }

      return result
    },
    onSuccess: (data: SignInResponse) => {
      // Navigate to enhance page on successful login
      if (data.user) {
        router.push(authConfig.callbacks.signIn)
        router.refresh()
      }
    },
  })
}
