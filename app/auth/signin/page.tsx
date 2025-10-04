import { LoginContainer } from '@/features/auth'
import { Suspense } from 'react'

// Auth pages need dynamic behavior for redirects and error handling
export const dynamic = 'force-dynamic'

function SignInContent() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">PromptOK</h1>
          <p className="text-gray-600">Welcome back</p>
        </div>
        <LoginContainer />
      </div>
    </div>
  )
}

export default function SignInPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <SignInContent />
    </Suspense>
  )
}
