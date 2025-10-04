import { useMutation } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { pathsConfig, authConfig } from '@/lib/config'

interface SignUpCredentials {
  email: string
  password: string
  name?: string
}

interface SignUpResponse {
  success: boolean
  message?: string
  error?: string
  user?: {
    id: string
    email: string
  }
}

/**
 * Hook for user sign up
 * Handles new user registration with React Query
 */
export function useSignUp() {
  const router = useRouter()

  return useMutation({
    mutationKey: ['auth', 'sign-up'],
    mutationFn: async (credentials: SignUpCredentials): Promise<SignUpResponse> => {
      const response = await fetch(pathsConfig.api.auth.signup, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(credentials),
      })

      const result = await response.json()

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to create account')
      }

      return result
    },
    onSuccess: (data: SignUpResponse) => {
      if (data.user) {
        router.push(authConfig.callbacks.signIn)
        router.refresh()
      }
    },
  })
}
