import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { authConfig } from '@/lib/config'

/**
 * Hook for user sign out
 * Handles logout and cache invalidation
 */
export function useSignOut() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const supabase = createClient()

  return useMutation({
    mutationKey: ['auth', 'sign-out'],
    mutationFn: async () => {
      const { error } = await supabase.auth.signOut()
      
      if (error) {
        throw new Error(error.message)
      }

      return { success: true }
    },
    onSuccess: () => {
      // Clear all cached queries
      queryClient.clear()
      
      // Redirect to sign in page
      router.push(authConfig.callbacks.signOut)
      router.refresh()
    },
  })
}
