'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { AuthService } from '@/lib/auth-service'
import type { User } from '@supabase/supabase-js'

export default function PageNavigationClient() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const checkUser = async () => {
      try {
        const authService = new AuthService()
        const currentUser = await authService.getCurrentUser()
        setUser(currentUser || null)
      } catch (error) {
        console.error('Error checking user session:', error)
        setUser(null)
      } finally {
        setLoading(false)
      }
    }

    checkUser()
  }, [])

  const isAuthed = Boolean(user)

  return (
    <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
      <Link 
        href="/"
        className="inline-flex h-10 items-center rounded-md border border-gray-300 bg-white px-4 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
      >
        ← Back to Home
      </Link>
      {loading ? (
        <div className="inline-flex h-10 items-center rounded-md bg-gray-100 px-4 text-sm font-medium text-gray-500">
          Loading...
        </div>
      ) : isAuthed ? (
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
