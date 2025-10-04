'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'

/**
 * React Query Provider Component
 * Provides query client for data fetching, caching, and state management
 * Based on reference implementation from nextjs-saas-starter-kit-lite
 */
export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Stale time: 5 minutes
            staleTime: 5 * 60 * 1000,
            // Cache time: 10 minutes
            gcTime: 10 * 60 * 1000,
            // Retry failed requests 3 times with exponential backoff
            retry: 3,
            // Don't refetch on window focus in development
            refetchOnWindowFocus: process.env.NODE_ENV === 'production',
            // Refetch on reconnect
            refetchOnReconnect: true,
          },
          mutations: {
            // Retry mutations once
            retry: 1,
          },
        },
      })
  )

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  )
}
