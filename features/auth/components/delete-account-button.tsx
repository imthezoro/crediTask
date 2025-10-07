'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createClient } from '@/lib/supabase/client'

interface DeleteAccountButtonProps {
  userEmail: string
  isGuest: boolean
}

export function DeleteAccountButton({ userEmail, isGuest }: DeleteAccountButtonProps) {
  const [showConfirmation, setShowConfirmation] = useState(false)
  const [confirmationText, setConfirmationText] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()
  const supabase = createClient()

  const expectedConfirmation = isGuest ? 'DELETE GUEST ACCOUNT' : 'DELETE MY ACCOUNT'

  const handleDeleteAccount = async () => {
    if (confirmationText !== expectedConfirmation) {
      setError(`Please type "${expectedConfirmation}" to confirm`)
      return
    }

    setLoading(true)
    setError('')

    try {
      // Call the Edge Function for secure soft deletion
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session) {
        setError('No active session found')
        return
      }

      const response = await fetch('/api/auth/delete-account', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          userId: session.user.id,
          userEmail: userEmail,
          isGuest: isGuest
        })
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to delete account')
      }

      // Sign out the user
      await supabase.auth.signOut()
      
      // Redirect to signin with success message
      router.push('/auth/signin?message=Account has been permanently deleted')
      
    } catch (err) {
      console.error('Account deletion error:', err)
      setError(err instanceof Error ? err.message : 'Failed to delete account')
    } finally {
      setLoading(false)
    }
  }

  if (!showConfirmation) {
    return (
      <div className="space-y-4">
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <h3 className="font-medium text-red-900 mb-2">Delete Account</h3>
          <p className="text-sm text-red-700 mb-4">
            {isGuest 
              ? 'This will permanently delete your guest account and all associated data. This action cannot be undone.'
              : 'This will permanently delete your account and all associated data. Your email will be blocked for 7 days to prevent immediate re-registration. This action cannot be undone.'
            }
          </p>
          <Button 
            variant="destructive" 
            onClick={() => setShowConfirmation(true)}
            className="w-full"
          >
            Delete Account
          </Button>
        </div>
      </div>
    )
  }

  return (
    <Card className="border-red-200">
      <CardHeader>
        <CardTitle className="text-red-900">Confirm Account Deletion</CardTitle>
        <CardDescription>
          This action cannot be undone. Your account and all data will be permanently deleted.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="confirmation">
            Type &quot;{expectedConfirmation}&quot; to confirm:
          </Label>
          <Input
            id="confirmation"
            value={confirmationText}
            onChange={(e) => setConfirmationText(e.target.value)}
            placeholder={expectedConfirmation}
            className="font-mono"
          />
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        <div className="flex space-x-3">
          <Button
            variant="outline"
            onClick={() => {
              setShowConfirmation(false)
              setConfirmationText('')
              setError('')
            }}
            disabled={loading}
            className="flex-1"
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleDeleteAccount}
            disabled={loading || confirmationText !== expectedConfirmation}
            className="flex-1"
          >
            {loading ? 'Deleting...' : 'Delete Account'}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
