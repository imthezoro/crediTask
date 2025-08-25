"use client"

import { useState } from 'react'
import { getSupabaseBrowser } from '@/lib/supabase-client'

type Props = {
  userEmail: string | null
  isGuest: boolean
}

export default function AccountActions({ userEmail, isGuest }: Props) {
  const supabase = getSupabaseBrowser()
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
    if (!confirm('Are you sure you want to delete your account? This will deactivate your profile.')) return
    setMessage(null)
    setError(null)
    setLoadingDelete(true)
    try {
      const res = await fetch('/api/account/deactivate', { method: 'POST' })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error || 'Failed to deactivate account')
      }
      // Sign out locally
      await supabase.auth.signOut()
      setMessage('Account deactivated. Redirecting to sign in...')
      setTimeout(() => {
        window.location.href = '/auth/signin'
      }, 1000)
    } catch (e: any) {
      setError(e?.message ?? 'Failed to deactivate account')
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
        <p className="text-sm text-gray-600 mb-3">Deactivate your account. You can contact support to re-activate later.</p>
        <button
          onClick={onDeleteAccount}
          disabled={loadingDelete}
          className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors"
        >
          {loadingDelete ? 'Processing...' : 'Delete Account'}
        </button>
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
