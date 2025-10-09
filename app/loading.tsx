import { Loader2 } from 'lucide-react'

/**
 * Global Loading State
 * Shown when navigating between pages or loading data
 */
export default function Loading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
      <div className="text-center space-y-4">
        {/* Spinner */}
        <div className="flex justify-center">
          <Loader2 className="w-12 h-12 text-blue-600 dark:text-blue-400 animate-spin" />
        </div>
        
        {/* Loading Text */}
        <div className="space-y-2">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
            Loading...
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Please wait while we load your content
          </p>
        </div>
      </div>
    </div>
  )
}
