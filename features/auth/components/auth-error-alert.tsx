import React from 'react'

interface AuthErrorAlertProps {
  error: Error | null
  errorType?: 'error' | 'warning' | 'RATE_LIMIT'
}

/**
 * Reusable error alert component for authentication flows
 * Handles different error types with appropriate styling
 */
export function AuthErrorAlert({ error, errorType = 'error' }: AuthErrorAlertProps) {
  if (!error) return null

  const isRateLimit = errorType === 'RATE_LIMIT'

  return (
    <div
      className={`p-3 text-sm border rounded-md ${
        isRateLimit
          ? 'text-orange-700 bg-orange-50 border-orange-200'
          : 'text-red-600 bg-red-50 border-red-200'
      }`}
    >
      {isRateLimit && (
        <div className="flex items-center mb-1">
          <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
              clipRule="evenodd"
            />
          </svg>
          <span className="font-medium">Rate Limit Reached</span>
        </div>
      )}
      {error.message}
      {isRateLimit && (
        <div className="mt-2 text-xs text-orange-600">
          This helps protect our service. You can try signing up for a permanent account instead.
        </div>
      )}
    </div>
  )
}
