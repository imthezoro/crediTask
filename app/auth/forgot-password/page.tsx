'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage(null)

    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      })

      const result = await res.json().catch(() => ({ success: true, message: 'If an account is associated with that email, a reset link has been sent' }))

      // The API intentionally returns a generic success message regardless of whether the email exists
      setMessage(
        result?.message ||
        "Account associated with that email will receive a password reset link shortly. Please check your inbox and spam folder."
      )
      // Optional UX: clear the email after showing success
      setEmail('')
    } catch {
      // Also show generic success to avoid user enumeration timing
      setMessage("Account associated with that email will receive a password reset link shortly. Please check your inbox and spam folder.")
      setEmail('')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl text-center">Forgot your password?</CardTitle>
          <CardDescription className="text-center">
            Enter your email address and we'll send you a link to reset it
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {message ? (
            <div className="p-3 text-sm border rounded-md text-green-700 bg-green-50 border-green-200" aria-live="polite">
              {message}
            </div>
          ) : null}

          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                disabled={loading || !!message}
              />
            </div>

            <Button type="submit" className="w-full" disabled={loading || !!message}>
              {loading ? 'Sending…' : (message ? 'Check your email' : 'Send reset link')}
            </Button>
            <p className="text-xs text-muted-foreground text-center">
              The link may take a minute to arrive. Be sure to check your spam folder.
            </p>
          </form>

          <div className="text-center text-sm">
            <Link href="/auth/signin" className="text-primary hover:underline">
              Back to sign in
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
