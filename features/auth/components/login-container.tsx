'use client'

import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { useSignIn, useGuestLogin } from '../hooks'
import { createClient } from '@/lib/supabase/client'
import { getAuthErrorDetails } from '../utils/auth-errors'
import { appConfig, pathsConfig } from '@/lib/config'
import { PasswordSignInForm } from './password-sign-in-form'
import { AuthErrorAlert } from './auth-error-alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import Link from 'next/link'
import type { LoginFormData } from '../schemas/auth-schemas'

/**
 * Container component for login functionality
 * Handles business logic and state management
 */
export function LoginContainer() {
  const [urlError, setUrlError] = useState<string>('')
  const [urlErrorType, setUrlErrorType] = useState<'error' | 'warning' | 'RATE_LIMIT'>('error')
  const [googleLoading, setGoogleLoading] = useState(false)
  
  const signInMutation = useSignIn()
  const guestLoginMutation = useGuestLogin()
  const searchParams = useSearchParams()
  const supabase = createClient()

  // Handle URL error parameters from redirects
  useEffect(() => {
    const sp = searchParams ?? new URLSearchParams()
    const error = sp.get('error')
    const customMessage = sp.get('message')

    if (error) {
      if (customMessage) {
        setUrlError(decodeURIComponent(customMessage))
        setUrlErrorType('error')
      } else {
        const errorDetails = getAuthErrorDetails(decodeURIComponent(error))
        setUrlError(errorDetails.message)
        setUrlErrorType(errorDetails.type === 'warning' ? 'RATE_LIMIT' : 'error')
      }

      // Clean URL after showing error
      const url = new URL(window.location.href)
      url.searchParams.delete('error')
      url.searchParams.delete('message')
      window.history.replaceState({}, '', url.toString())
    }
  }, [searchParams])

  // Handle email/password sign in
  const handleEmailSignIn = useCallback(
    async (data: LoginFormData) => {
      setUrlError('') // Clear URL errors on new submission
      await signInMutation.mutateAsync(data)
    },
    [signInMutation]
  )

  // Handle Google OAuth sign in
  const handleGoogleSignIn = async () => {
    setGoogleLoading(true)
    setUrlError('')

    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${appConfig.url}${pathsConfig.auth.callback}`,
        },
      })

      if (error) {
        setUrlError(error.message)
        setUrlErrorType('error')
      }
    } catch {
      const errorDetails = getAuthErrorDetails('AUTHENTICATION_FAILED')
      setUrlError(errorDetails.message)
      setUrlErrorType(errorDetails.type)
    } finally {
      setGoogleLoading(false)
    }
  }

  // Handle guest login
  const handleGuestLogin = async () => {
    setUrlError('')
    try {
      await guestLoginMutation.mutateAsync()
    } catch {
      // Error handled by mutation
    }
  }

  const isLoading = signInMutation.isPending || guestLoginMutation.isPending || googleLoading

  // Determine which error to show (URL error or mutation error)
  const displayError = urlError || signInMutation.error || guestLoginMutation.error
  type MutationError = { errorType?: 'error' | 'warning' | 'RATE_LIMIT' }
  const displayErrorType = urlError
    ? urlErrorType
    : ((guestLoginMutation.error as unknown as MutationError)?.errorType ?? 'error')

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl text-center">Sign in</CardTitle>
        <CardDescription className="text-center">
          Enter your email and password to sign in to your account
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {displayError && (
          <AuthErrorAlert
            error={displayError as Error}
            errorType={displayErrorType}
          />
        )}

        <PasswordSignInForm
          onSubmit={handleEmailSignIn}
          loading={signInMutation.isPending}
        />

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-background px-2 text-muted-foreground">
              Or continue with
            </span>
          </div>
        </div>

        <Button
          variant="outline"
          className="w-full"
          onClick={handleGoogleSignIn}
          disabled={isLoading}
        >
          <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
            <path
              fill="currentColor"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="currentColor"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="currentColor"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            />
            <path
              fill="currentColor"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            />
          </svg>
          Continue with Google
        </Button>

        <Button
          variant="secondary"
          className="w-full"
          onClick={handleGuestLogin}
          disabled={isLoading}
        >
          <svg
            className="mr-2 h-4 w-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
          Continue as Guest/Anonymous
        </Button>

        <div className="text-center text-sm">
          Don&apos;t have an account?{' '}
          <Link href={pathsConfig.auth.signUp} className="text-primary hover:underline">
            Sign up
          </Link>
        </div>
      </CardContent>
    </Card>
  )
}
