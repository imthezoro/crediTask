'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface CleanupStats {
  usersFound: number,
  usersDeleted: number,
  sessionsDeleted: number,
  cutoffDate: string,
  dryRun: boolean,
}

export function GuestCleanupButton() {
  const [loading, setLoading] = useState(false)
  const [olderThanDays, setOlderThanDays] = useState(7)
  const [stats, setStats] = useState<CleanupStats | null>(null)
  const [error, setError] = useState('')
  const [showConfirm, setShowConfirm] = useState(false)

  const handlePreview = async () => {
    setLoading(true)
    setError('')
    setStats(null)

    try {
      const response = await fetch('/api/admin/cleanup-guests', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          olderThanDays,
          dryRun: true,
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        setError(result.error || 'Failed to preview cleanup')
        return
      }

      setStats(result.stats)
      if (result.stats.usersFound > 0) {
        setShowConfirm(true)
      }
    } catch (err) {
      setError('Network error occurred')
    } finally {
      setLoading(false)
    }
  }

  const handleExecute = async () => {
    setLoading(true)
    setError('')

    try {
      const response = await fetch('/api/admin/cleanup-guests', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          olderThanDays,
          dryRun: false,
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        setError(result.error || 'Failed to execute cleanup')
        return
      }

      setStats(result.stats)
      setShowConfirm(false)
    } catch (err) {
      setError('Network error occurred')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <svg className="w-5 h-5 text-orange-600" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" clipRule="evenodd" />
            <path fillRule="evenodd" d="M4 5a2 2 0 012-2h8a2 2 0 012 2v6a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 2a1 1 0 000 2h6a1 1 0 100-2H7zm0 4a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
          </svg>
          Guest User Cleanup
        </CardTitle>
        <CardDescription>
          Remove old guest accounts and their data to prevent database bloat
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md">
            {error}
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="days">Delete guest accounts older than (days)</Label>
          <Input
            id="days"
            type="number"
            min="0"
            max="365"
            value={olderThanDays}
            onChange={(e) => setOlderThanDays(parseInt(e.target.value) || 7)}
            className="w-32"
          />
          <p className="text-xs text-gray-500">
            Use 0 to delete all guest accounts. Recommended: 7 days (guest accounts are ephemeral)
          </p>
        </div>

        {stats && (
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-md">
            <h4 className="font-medium text-blue-900 mb-2">
              {stats.dryRun ? 'Preview Results' : 'Cleanup Results'}
            </h4>
            <div className="text-sm text-blue-800 space-y-1">
              <p>• Found: {stats.usersFound} guest users</p>
              {!stats.dryRun && (
                <>
                  <p>• Deleted: {stats.usersDeleted} user profiles</p>
                  <p>• Deleted: {stats.sessionsDeleted} prompt sessions</p>
                </>
              )}
              <p>• Cutoff date: {new Date(stats.cutoffDate).toLocaleDateString()}</p>
            </div>
          </div>
        )}

        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={handlePreview}
            disabled={loading}
          >
            {loading ? 'Loading...' : 'Preview Cleanup'}
          </Button>

          {showConfirm && stats && stats.usersFound > 0 && (
            <Button
              variant="destructive"
              onClick={handleExecute}
              disabled={loading}
            >
              {loading ? 'Executing...' : `Delete ${stats.usersFound} Guest Users`}
            </Button>
          )}
        </div>

        <div className="text-xs text-gray-500 space-y-1">
          <p>⚠️ This action will:</p>
          <ul className="list-disc list-inside ml-2 space-y-1">
            <li>Soft delete guest user profiles (set is_active=false)</li>
            <li>Hard delete prompt sessions for guest users</li>
            <li>Hard delete guest users from Supabase Auth</li>
            <li>Log the cleanup action in audit logs</li>
          </ul>
          <p className="font-medium">Always preview before executing!</p>
        </div>
      </CardContent>
    </Card>
  )
}
