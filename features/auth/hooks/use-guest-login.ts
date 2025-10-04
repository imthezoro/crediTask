import { useMutation } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { pathsConfig, authConfig } from '@/lib/config'

interface GuestLoginResponse {
  success: boolean
  error?: string
  errorType?: 'error' | 'warning' | 'RATE_LIMIT'
}

/**
 * Hook for guest/anonymous login
 * Handles guest authentication with rate limit handling
 */
export function useGuestLogin() {
  const router = useRouter()

  return useMutation({
    mutationKey: ['auth', 'guest-login'],
    mutationFn: async (): Promise<GuestLoginResponse> => {
      const response = await fetch(pathsConfig.api.auth.guestLogin, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      const result = await response.json()

      if (!response.ok || !result.success) {
        const error = new Error(result.error || 'Failed to create guest session') as Error & {
          errorType?: string
        }
        error.errorType = result.errorType || 'error'
        throw error
      }

      return result
    },
    onSuccess: () => {
      router.push(authConfig.callbacks.signIn)
      router.refresh()
    },
  })
}
