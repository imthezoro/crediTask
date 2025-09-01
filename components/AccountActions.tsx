"use client"

import { useState } from 'react'
import { createClient } from '@/lib/supabase-client'

type Props = {
  userEmail: string | null
  isGuest: boolean
}

export default function AccountActions({ userEmail, isGuest }: Props) {
  const supabase = createClient()
  const [loadingReset, setLoadingReset] = useState(false)
  const [loadingDelete, setLoadingDelete] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const onResetPassword = async () => {
    if (!userEmail) return
    setMessage(null)
    setError(null)
    setLoadingReset(true)
    try {
      const redirectTo = `${window.location.origin}/auth/reset-password-confirm`
      const { error } = await supabase.auth.resetPasswordForEmail(userEmail, { redirectTo })
      if (error) throw error
      setMessage('Password reset email sent.')
    } catch (e: any) {
      setError(e?.message ?? 'Failed to send reset email')
    } finally {
      setLoadingReset(false)
    }
  }

  const onDeleteAccount = async () => {
    // Prevent guest users from deleting accounts
    if (isGuest) {
      setError('Guest accounts cannot be permanently deleted. Please create a regular account first.')
      return
    }

    if (!confirm('Are you sure you want to permanently delete your account? This will remove all your data and block your email for 7 days.')) return
    setMessage(null)
    setError(null)
    setLoadingDelete(true)
    try {
      // Get current user session
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        throw new Error('No active session')
      }

      const res = await fetch('/api/auth/delete-account', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId: user.id,
          userEmail: userEmail,
          isGuest: isGuest
        })
      })
      
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error || 'Failed to delete account')
      }
      
      // Sign out locally
      await supabase.auth.signOut()
      setMessage('Account permanently deleted. Redirecting to sign in...')
      setTimeout(() => {
        window.location.href = '/auth/signin'
      }, 1000)
    } catch (e: any) {
      setError(e?.message ?? 'Failed to delete account')
    } finally {
      setLoadingDelete(false)
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-medium text-gray-900 mb-2">Reset Password</h3>
        <p className="text-sm text-gray-600 mb-3">Send a password reset email to your registered email address.</p>
        <button
          onClick={onResetPassword}
          disabled={isGuest || !userEmail || loadingReset}
          className={`px-4 py-2 rounded-lg transition-colors text-white ${isGuest || !userEmail ? 'bg-gray-300 cursor-not-allowed' : 'bg-gray-600 hover:bg-gray-700'}`}
        >
          {loadingReset ? 'Sending...' : 'Reset Password'}
        </button>
        {isGuest && (
          <p className="text-xs text-gray-500 mt-2">Password reset is disabled for guest accounts.</p>
        )}
      </div>

      <div className="border-t pt-4">
        <h3 className="font-medium text-red-600 mb-2">Danger Zone</h3>
        <p className="text-sm text-gray-600 mb-3">Permanently delete your account and all data. Email will be blocked for 7 days.</p>
        <button
          onClick={onDeleteAccount}
          disabled={isGuest || loadingDelete}
          className={`px-4 py-2 rounded-lg transition-colors text-white ${isGuest ? 'bg-gray-300 cursor-not-allowed' : 'bg-red-600 hover:bg-red-700'}`}
        >
          {loadingDelete ? 'Processing...' : 'Delete Account'}
        </button>
        {isGuest && (
          <p className="text-xs text-gray-500 mt-2">Account deletion is disabled for guest accounts.</p>
        )}
      </div>

      {(message || error) && (
        <div className="pt-2">
          {message && <p className="text-sm text-green-600">{message}</p>}
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
      )}
    </div>
  )
}
