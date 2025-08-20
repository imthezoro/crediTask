'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { authService } from '@/lib/auth-service'

interface FormState {
  email: string
  password: string
  loading: boolean
  googleLoading: boolean
  error: string
}

export default function SignInPage() {
  const [formState, setFormState] = useState<FormState>({
    email: '',
    password: '',
    loading: false,
    googleLoading: false,
    error: ''
  })

  const updateFormState = (updates: Partial<FormState>) => {
    setFormState(prev => ({ ...prev, ...updates }))
  }

  const clearError = () => updateFormState({ error: '' })

  // Handle OAuth tokens in URL hash
  useEffect(() => {
    const handleOAuthTokens = async () => {
      if (typeof window === 'undefined') return
      
      const hash = window.location.hash
      if (!hash || !hash.includes('access_token')) return

      try {
        const hashParams = new URLSearchParams(hash.substring(1))
        const accessToken = hashParams.get('access_token')
        const refreshToken = hashParams.get('refresh_token')

        if (!accessToken || !refreshToken) {
          throw new Error('Missing required tokens')
        }

        const supabase = authService.getSupabaseClient()
        const { data, error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        })

        if (error) {
          throw new Error(error.message)
        }

        // Clean URL to remove sensitive tokens
        window.history.replaceState(
          {},
          document.title,
          window.location.pathname + window.location.search
        )

        if (data?.session) {
          authService.storeAuthData(data.session)
          authService.notifyExtension('SIGNED_IN', data.session)
          window.location.replace('/dashboard')
        }
      } catch (error) {
        console.error('OAuth token handling failed:', error)
        updateFormState({ 
          error: `Authentication failed: ${error instanceof Error ? error.message : 'Unknown error'}` 
        })
      }
    }

    handleOAuthTokens()
  }, [])

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formState.email || !formState.password) {
      updateFormState({ error: 'Please enter both email and password' })
      return
    }

    updateFormState({ loading: true, error: '' })

    try {
      const supabase = authService.getSupabaseClient()
      const { data, error } = await supabase.auth.signInWithPassword({
        email: formState.email,
        password: formState.password,
      })

      if (error) {
        throw new Error(error.message)
      }

      if (data.session) {
        authService.storeAuthData(data.session)
        authService.notifyExtension('SIGNED_IN', data.session)
        window.location.href = '/dashboard'
      } else {
        throw new Error('No session created')
      }
    } catch (error) {
      updateFormState({ 
        error: error instanceof Error ? error.message : 'Sign in failed' 
      })
    } finally {
      updateFormState({ loading: false })
    }
  }

  const handleGoogleSignIn = async () => {
    updateFormState({ googleLoading: true, error: '' })
    
    try {
      const supabase = authService.getSupabaseClient()
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`
        }
      })
      
      if (error) {
        throw new Error(error.message)
      }
      // User will be redirected to Google OAuth flow
    } catch (error) {
      updateFormState({ 
        error: `Google sign-in failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        googleLoading: false 
      })
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
          Sign in to PromptOK
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          Or{' '}
          <Link href="/auth/signup" className="font-medium text-blue-600 hover:text-blue-500">
            create a new account
          </Link>
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          <form className="space-y-6" onSubmit={handleEmailSignIn}>
            {formState.error && (
              <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded" role="alert">
                {formState.error}
              </div>
            )}

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                Email address
              </label>
              <div className="mt-1">
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={formState.email}
                  onChange={(e) => {
                    updateFormState({ email: e.target.value })
                    if (formState.error) clearError()
                  }}
                  className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  disabled={formState.loading || formState.googleLoading}
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                Password
              </label>
              <div className="mt-1">
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={formState.password}
                  onChange={(e) => {
                    updateFormState({ password: e.target.value })
                    if (formState.error) clearError()
                  }}
                  className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  disabled={formState.loading || formState.googleLoading}
                />
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={formState.loading || formState.googleLoading}
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {formState.loading ? 'Signing in...' : 'Sign in'}
              </button>
            </div>
          </form>

          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-gray-500">Or continue with</span>
              </div>
            </div>

            <div className="mt-6">
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={formState.googleLoading || formState.loading}
                className="w-full inline-flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" aria-hidden="true">
                  <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                <span className="ml-2">
                  {formState.googleLoading ? 'Connecting...' : 'Continue with Google'}
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
