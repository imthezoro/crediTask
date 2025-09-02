'use client'

import { useEffect, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase-client'

export default function ResetPasswordConfirmPage() {
  const [message, setMessage] = useState('Loading...')
  const [error, setError] = useState<string | null>(null)
  const [isInitializing, setIsInitializing] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPasswordForm, setShowPasswordForm] = useState(false)
  const [supabaseClient, setSupabaseClient] = useState<SupabaseClient | null>(null)

  useEffect(() => {
    const handlePasswordReset = async () => {
      try {
        const supabase = createClient()

        // Store the client for later use
        setSupabaseClient(supabase)

        const currentUrl = new URL(window.location.href)
        const errorParam = currentUrl.searchParams.get('error')
        const errorDescription = currentUrl.searchParams.get('error_description')

        if (errorParam) {
          throw new Error(`Reset error: ${errorDescription || errorParam}`)
        }

        // Check if we have the necessary tokens/params in the URL
        const hasHash = window.location.hash && window.location.hash.includes('access_token')
        // Supabase may send one of: code (PKCE), token, or token_hash for recovery
        const code = currentUrl.searchParams.get('code')
        const token = currentUrl.searchParams.get('token') || currentUrl.searchParams.get('token_hash')

        // Do not perform PKCE exchange on password reset page.
        // If only a code is present (no hash), attempt recovery verification to establish session.
        if ((code || token) && !hasHash) {
          const { error: verifyError } = await supabase.auth.verifyOtp({
            type: 'recovery',
            token_hash: code || token || '',
          })
          if (verifyError) {
            // Continue to retry loop which may still succeed if session was set asynchronously
            console.warn('Recovery verifyOtp error:', verifyError.message)
          }
        }

        if (hasHash || code || token) {
          // Retry logic to allow enough time for session establishment
          let established = false
          for (let i = 0; i < 3; i++) {
            await new Promise(resolve => setTimeout(resolve, i === 0 ? 800 : 1000))
            const { data: sessionData } = await supabase.auth.getSession()
            if (sessionData.session) {
              established = true
              break
            }
          }

          if (established) {
            console.log('Session established successfully')
            // Clean URL (remove tokens/code) to prevent reprocessing on refresh
            try {
              const cleanUrl = window.location.origin + window.location.pathname
              window.history.replaceState({}, document.title, cleanUrl)
            } catch {}
            setMessage('Please enter your new password')
            setShowPasswordForm(true)
            setIsInitializing(false)
          } else {
            throw new Error('Failed to establish reset session. Please request a new password reset.')
          }
        } else {
          throw new Error('Invalid reset link. Please request a new password reset.')
        }

      } catch (e) {
        const errorMessage = e instanceof Error ? e.message : 'Unknown error occurred'
        console.error('Reset password confirm error:', e)
        setError(errorMessage)
        setMessage('Password reset failed')
        // Clean URL even on error to strip sensitive params
        try {
          const cleanUrl = window.location.origin + window.location.pathname
          window.history.replaceState({}, document.title, cleanUrl)
        } catch {}
        setIsInitializing(false)
      }
    };

    handlePasswordReset()
  }, [])

  const handleSubmitNewPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!newPassword || newPassword.length < 6) {
      setError('Password must be at least 6 characters long')
      return
    }

    // Basic strength check: at least one number and one special character
    const passwordRegex = /^(?=.*[0-9])(?=.*[!@#$%^&*])/ 
    if (!passwordRegex.test(newPassword)) {
      setError('Password must contain at least one number and one special character')
      return
    }
    
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    if (!supabaseClient) {
      setError('Authentication system not ready. Please refresh the page.')
      return
    }

    try {
      setIsSubmitting(true)
      setError(null)

      // Verify we still have a valid session
      const { data: sessionData } = await supabaseClient.auth.getSession()
      
      if (!sessionData.session) {
        throw new Error('Session expired. Please request a new password reset.')
      }

      // Update the password using the established session
      const { error: updateError } = await supabaseClient.auth.updateUser({
        password: newPassword,
      })

      if (updateError) {
        throw new Error(updateError.message)
      }

      setMessage('Password updated successfully! Please use the PromptOK browser extension to sign in with your new password.')
      setShowPasswordForm(false)

      // Redirect to signin after a short delay
      setTimeout(() => {
        try {
          window.location.href = '/auth/signin'
        } catch {}
      }, 3000)

    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : 'Failed to update password'
      setError(errorMessage)
    } finally {
      setIsSubmitting(false)
    }
  };

  return (
    <main style={{ padding: 24, fontFamily: 'sans-serif', maxWidth: 400, margin: '0 auto' }}>
      <h1>PromptOK</h1>
      <h2>Reset Password</h2>
      
      {isInitializing && !showPasswordForm && <p>Loading...</p>}
      
      {showPasswordForm && (
        <form onSubmit={handleSubmitNewPassword} style={{ marginTop: 20 }}>
          <div style={{ marginBottom: 16 }}>
            <input
              type="password"
              placeholder="New password (min 6 characters)"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              style={{
                width: '100%',
                padding: 12,
                border: '1px solid #ddd',
                borderRadius: 4,
                fontSize: 14,
              }}
              required
              minLength={6}
            />
          </div>
          <div style={{ marginBottom: 16 }}>
            <input
              type="password"
              placeholder="Confirm new password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              style={{
                width: '100%',
                padding: 12,
                border: '1px solid #ddd',
                borderRadius: 4,
                fontSize: 14,
              }}
              required
            />
          </div>
          <button
            type="submit"
            disabled={isSubmitting}
            style={{
              width: '100%',
              padding: 12,
              backgroundColor: '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: 4,
              fontSize: 16,
              cursor: isSubmitting ? 'not-allowed' : 'pointer',
              opacity: isSubmitting ? 0.7 : 1,
            }}
          >
            {isSubmitting ? 'Updating...' : 'Update Password'}
          </button>
        </form>
      )}
      
      {!isInitializing && !showPasswordForm && (
        <p style={{ color: '#28a745' }}>{message}</p>
      )}
      
      {error && (
        <p style={{ color: '#dc3545', marginTop: 16 }}>{error}</p>
      )}
    </main>
  );
}
