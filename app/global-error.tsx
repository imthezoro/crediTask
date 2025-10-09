'use client'

import { useEffect } from 'react'
import { AlertTriangle, RefreshCcw, Home } from 'lucide-react'

/**
 * Global Error Handler
 * Catches errors in root layout and error boundaries
 * Must be a client component and must render html/body tags
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('Global error caught:', error)
  }, [error])

  return (
    <html lang="en">
      <body>
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 to-red-100 dark:from-gray-900 dark:to-gray-800 p-4">
          <div className="w-full max-w-lg bg-white dark:bg-gray-800 rounded-lg shadow-2xl border border-red-200 dark:border-red-900">
            {/* Header */}
            <div className="text-center space-y-4 p-8 border-b border-gray-200 dark:border-gray-700">
              {/* Error Icon */}
              <div className="flex justify-center">
                <div className="w-20 h-20 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                  <AlertTriangle className="w-10 h-10 text-red-600 dark:text-red-400" />
                </div>
              </div>
              
              <div className="space-y-2">
                <h1 className="text-3xl font-bold text-red-600 dark:text-red-400">
                  Critical Error
                </h1>
                <p className="text-base text-gray-600 dark:text-gray-400">
                  A critical error occurred in the application. Please try refreshing the page.
                </p>
              </div>
            </div>
            
            {/* Content */}
            <div className="p-8 space-y-6">
              {/* Error Details (Development Only) */}
              {process.env.NODE_ENV === 'development' && (
                <details className="text-sm text-gray-600 dark:text-gray-400">
                  <summary className="cursor-pointer font-medium hover:text-gray-900 dark:hover:text-gray-200 mb-3">
                    🔍 Error Details (Development)
                  </summary>
                  <div className="space-y-2">
                    <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
                      <p className="font-mono text-xs break-all">
                        <span className="font-semibold">Message:</span> {error.message}
                      </p>
                      {error.digest && (
                        <p className="font-mono text-xs mt-2">
                          <span className="font-semibold">Digest:</span> {error.digest}
                        </p>
                      )}
                      {error.stack && (
                        <pre className="mt-2 text-xs overflow-auto max-h-40 p-2 bg-white dark:bg-gray-900 rounded">
                          {error.stack}
                        </pre>
                      )}
                    </div>
                  </div>
                </details>
              )}

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={reset}
                  className="flex-1 px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                >
                  <RefreshCcw className="w-4 h-4" />
                  Try Again
                </button>
                <button
                  onClick={() => window.location.href = '/'}
                  className="flex-1 px-6 py-3 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 text-gray-900 dark:text-gray-100 border border-gray-300 dark:border-gray-600 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                >
                  <Home className="w-4 h-4" />
                  Home
                </button>
              </div>

              {/* Help Text */}
              <div className="text-center pt-4 border-t border-gray-200 dark:border-gray-700">
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  If this error persists, please refresh your browser or{' '}
                  <a 
                    href="/contact" 
                    className="text-red-600 dark:text-red-400 hover:underline font-medium"
                  >
                    contact support
                  </a>
                </p>
              </div>
            </div>
          </div>
        </div>
      </body>
    </html>
  )
}
