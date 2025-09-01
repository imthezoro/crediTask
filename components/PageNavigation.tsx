import Link from 'next/link'
import { getHeaderData } from '@/lib/header-utils'

export default async function PageNavigation() {
  const { user } = await getHeaderData()
  const isAuthed = Boolean(user)

  return (
    <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
      <Link 
        href="/"
        className="inline-flex h-10 items-center rounded-md border border-gray-300 bg-white px-4 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
      >
        ← Back to Home
      </Link>
      {isAuthed ? (
        <Link 
          href="/dashboard"
          className="inline-flex h-10 items-center rounded-md bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
        >
          Go to Dashboard
        </Link>
      ) : (
        <>
          <Link 
            href="/auth/signin"
            className="inline-flex h-10 items-center rounded-md border border-blue-600 bg-white px-4 text-sm font-medium text-blue-600 hover:bg-blue-50 transition-colors"
          >
            Sign In
          </Link>
          <Link 
            href="/auth/signup"
            className="inline-flex h-10 items-center rounded-md bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
          >
            Get Started
          </Link>
        </>
      )}
    </div>
  )
}
