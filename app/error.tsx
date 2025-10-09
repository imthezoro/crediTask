'use client'

import { useEffect } from 'react'
import { AlertTriangle, RefreshCcw, Home } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { pathsConfig } from '@/lib/config'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('Global error:', error)
  }, [error])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 p-4">
      <Card className="w-full max-w-lg shadow-xl">
        <CardHeader className="text-center space-y-4">
          {/* Error Icon */}
          <div className="flex justify-center">
            <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
              <AlertTriangle className="w-8 h-8 text-red-600 dark:text-red-400" />
            </div>
          </div>
          
          <div className="space-y-2">
            <CardTitle className="text-2xl text-red-600 dark:text-red-400">
              Something Went Wrong
            </CardTitle>
            <CardDescription className="text-base">
              We encountered an unexpected error. Don't worry, your data is safe.
            </CardDescription>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-6">
          {/* Error Details (Development Only) */}
          {process.env.NODE_ENV === 'development' && (
            <details className="text-sm text-gray-600 dark:text-gray-400">
              <summary className="cursor-pointer font-medium hover:text-gray-900 dark:hover:text-gray-200">
                🔍 Error Details (Development)
              </summary>
              <div className="mt-3 space-y-2">
                <div className="p-3 bg-gray-100 dark:bg-gray-800 rounded-lg">
                  <p className="font-mono text-xs break-all">
                    <span className="font-semibold">Message:</span> {error.message}
                  </p>
                  {error.digest && (
                    <p className="font-mono text-xs mt-2">
                      <span className="font-semibold">Digest:</span> {error.digest}
                    </p>
                  )}
                  {error.stack && (
                    <pre className="mt-2 text-xs overflow-auto max-h-32">
                      {error.stack}
                    </pre>
                  )}
                </div>
              </div>
            </details>
          )}

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3">
            <Button onClick={reset} className="flex-1" size="lg">
              <RefreshCcw className="w-4 h-4 mr-2" />
              Try Again
            </Button>
            <Button 
              variant="outline" 
              onClick={() => window.location.href = pathsConfig.app.dashboard}
              className="flex-1"
              size="lg"
            >
              <Home className="w-4 h-4 mr-2" />
              Dashboard
            </Button>
          </div>

          {/* Help Text */}
          <div className="text-center pt-4 border-t border-gray-200 dark:border-gray-700">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              If this error persists,{' '}
              <a 
                href={pathsConfig.app.contact} 
                className="text-blue-600 dark:text-blue-400 hover:underline font-medium"
              >
                contact support
              </a>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
