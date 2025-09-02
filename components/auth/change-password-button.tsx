'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Key } from 'lucide-react'

interface ChangePasswordButtonProps {
  userEmail: string
  isGuest: boolean
}

export function ChangePasswordButton({ userEmail, isGuest }: ChangePasswordButtonProps) {
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [isSuccess, setIsSuccess] = useState(false)

  const handleSubmit = async () => {
    setLoading(true)
    setMessage('')

    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: userEmail }),
      })

      const data = await response.json()

      if (data.success) {
        setIsSuccess(true)
        setMessage('Password reset link has been sent to your email address. Please check your inbox and follow the instructions to change your password.')
      } else {
        setMessage(data.message || 'Failed to send password reset email. Please try again.')
      }
    } catch (error) {
      console.error('Password reset error:', error)
      setMessage('An error occurred. Please try again later.')
    } finally {
      setLoading(false)
    }
  }

  const handleCancel = () => {
    setShowForm(false)
    setMessage('')
    setIsSuccess(false)
  }

  // Don't show for guest accounts
  if (isGuest) {
    return null
  }

  if (!showForm) {
    return (
      <div className="space-y-4">
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <h3 className="font-medium text-blue-900 mb-2">Change Password</h3>
          <p className="text-sm text-blue-700 mb-4">
            We&apos;ll send a password reset link to your email address. Click the link in the email to set a new password.
          </p>
          <Button 
            variant="outline" 
            onClick={() => setShowForm(true)}
            className="w-full"
          >
            <Key className="mr-2 h-4 w-4" />
            Change Password
          </Button>
        </div>
      </div>
    )
  }

  if (isSuccess) {
    return (
      <Card className="border-green-200">
        <CardHeader>
          <CardTitle className="text-green-900">Reset Link Sent</CardTitle>
          <CardDescription>
            Check your email for the password reset link.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-3 bg-green-50 border border-green-200 rounded-md">
            <p className="text-sm text-green-700">{message}</p>
          </div>
          
          <Button
            onClick={handleCancel}
            className="w-full"
          >
            Close
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-blue-200">
      <CardHeader>
        <CardTitle className="text-blue-900">Change Password</CardTitle>
        <CardDescription>
          A password reset link will be sent to your email address.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">Email Address</Label>
          <Input
            id="email"
            type="email"
            value={userEmail}
            disabled
            className="bg-muted"
          />
        </div>

        {message && !isSuccess && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm text-red-700">{message}</p>
          </div>
        )}

        <div className="flex space-x-3">
          <Button
            type="button"
            variant="outline"
            onClick={handleCancel}
            disabled={loading}
            className="flex-1"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={loading}
            className="flex-1"
          >
            {loading ? 'Sending...' : 'Send Reset Link'}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
