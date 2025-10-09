import Link from 'next/link'
import { Home, Search, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { pathsConfig } from '@/lib/config'

/**
 * Custom 404 Not Found Page
 * Shown when user navigates to non-existent route
 */
export default function NotFound() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center px-4">
      <div className="max-w-2xl w-full text-center space-y-8">
        {/* Large 404 Text */}
        <div className="space-y-4">
          <h1 className="text-9xl font-bold text-gray-200 dark:text-gray-700 select-none">
            404
          </h1>
          <div className="space-y-2">
            <h2 className="text-3xl font-semibold text-gray-900 dark:text-gray-100">
              Page Not Found
            </h2>
            <p className="text-lg text-gray-600 dark:text-gray-400 max-w-md mx-auto">
              Sorry, we couldn't find the page you're looking for. It might have been moved or deleted.
            </p>
          </div>
        </div>

        {/* Illustration/Icon */}
        <div className="flex justify-center">
          <div className="w-24 h-24 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
            <Search className="w-12 h-12 text-blue-600 dark:text-blue-400" />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
          <Button asChild size="lg" className="min-w-[200px]">
            <Link href={pathsConfig.app.home}>
              <Home className="w-4 h-4 mr-2" />
              Back to Home
            </Link>
          </Button>
          
          <Button asChild variant="outline" size="lg" className="min-w-[200px]">
            <Link href={pathsConfig.app.dashboard}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Go to Dashboard
            </Link>
          </Button>
        </div>

        {/* Help Text */}
        <div className="pt-8 border-t border-gray-200 dark:border-gray-700">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            If you believe this is an error, please{' '}
            <Link 
              href={pathsConfig.app.contact} 
              className="text-blue-600 dark:text-blue-400 hover:underline font-medium"
            >
              contact support
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
