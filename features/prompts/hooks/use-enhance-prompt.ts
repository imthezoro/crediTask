'use client'

import { useMutation } from '@tanstack/react-query'
import { pathsConfig } from '@/lib/config'

interface EnhancePromptParams {
  prompt: string
  site?: string
}

interface EnhancePromptResponse {
  success: boolean
  enhanced?: string
  error?: string
}

/**
 * Hook for AI prompt enhancement
 * Handles calling the enhance API endpoint
 */
export function useEnhancePrompt() {
  return useMutation({
    mutationKey: ['prompts', 'enhance'],
    mutationFn: async (params: EnhancePromptParams): Promise<EnhancePromptResponse> => {
      const response = await fetch(pathsConfig.api.enhance, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(params),
      })

      const result = await response.json()

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to enhance prompt')
      }

      return result
    },
  })
}
