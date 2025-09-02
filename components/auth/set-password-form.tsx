'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { authService } from '@/lib/auth-service'

interface SetPasswordFormProps {
  onSuccess?: () => void
  onCancel?: () => void
}

export function SetPasswordForm({ onSuccess, onCancel }: SetPasswordFormProps) {
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    
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

    try {
      setIsSubmitting(true)

      const result = await authService.setPassword(newPassword)

      if (!result.success) {
        throw new Error(result.error || 'Failed to set password')
      }

      const message = result.isGoogleOAuthUser 
        ? 'Password set successfully! You can now sign in with either Google or your new password.'
        : 'Password updated successfully!'
      
      setSuccess(message)
      setNewPassword('')
      setConfirmPassword('')
      
      // Call success callback after a short delay
      setTimeout(() => {
        onSuccess?.()
      }, 2000)

    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : 'Failed to set password'
      setError(errorMessage)
    } finally {
      setIsSubmitting(false)
    }
  }

  if (success) {
    return (
      <Card className="w-full max-w-md">
        <CardContent className="pt-6">
          <div className="p-3 text-sm border rounded-md text-green-700 bg-green-50 border-green-200" aria-live="polite">
            {success}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl text-center">Set Password</CardTitle>
        <CardDescription className="text-center">
          Set a password for your account to enable password-based sign in
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <div className="p-3 text-sm border rounded-md text-red-700 bg-red-50 border-red-200" aria-live="polite">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="newPassword">New Password</Label>
            <Input
              id="newPassword"
              type="password"
              placeholder="Enter new password (min 6 characters)"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              minLength={6}
              disabled={isSubmitting}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirm Password</Label>
            <Input
              id="confirmPassword"
              type="password"
              placeholder="Confirm new password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              disabled={isSubmitting}
            />
          </div>

          <div className="flex gap-2">
            <Button 
              type="submit" 
              className="flex-1" 
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Setting Password...' : 'Set Password'}
            </Button>
            {onCancel && (
              <Button 
                type="button" 
                variant="outline" 
                onClick={onCancel}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
            )}
          </div>
        </form>

        <p className="text-xs text-muted-foreground text-center">
          Password must contain at least one number and one special character
        </p>
      </CardContent>
    </Card>
  )
}
