'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

interface CleanupStats {
  blocksFound: number
  blocksDeleted: number
  dryRun: boolean
}

export function ExpiredBlocksCleanupButton() {
  const [loading, setLoading] = useState(false)
  const [stats, setStats] = useState<CleanupStats | null>(null)
  const [error, setError] = useState('')
  const [showConfirm, setShowConfirm] = useState(false)

  const handlePreview = async () => {
    setLoading(true)
    setError('')
    setStats(null)

    try {
      const response = await fetch('/api/admin/cleanup-expired-blocks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          dryRun: true,
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        setError(result.error || 'Failed to preview cleanup')
        return
      }

      setStats(result.stats)
      if (result.stats.blocksFound > 0) {
        setShowConfirm(true)
      }
    } catch {
      setError('Network error occurred')
    } finally {
      setLoading(false)
    }
  }

  const handleExecute = async () => {
    setLoading(true)
    setError('')

    try {
      const response = await fetch('/api/admin/cleanup-expired-blocks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
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
    } catch {
      setError('Network error occurred')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <svg className="w-5 h-5 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
          Expired Email Blocks Cleanup
        </CardTitle>
        <CardDescription>
          Remove expired email blocks to allow users to sign up again
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md">
            {error}
          </div>
        )}

        {stats && (
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-md">
            <h4 className="font-medium text-blue-900 mb-2">
              {stats.dryRun ? 'Preview Results' : 'Cleanup Results'}
            </h4>
            <div className="text-sm text-blue-800 space-y-1">
              <p>• Found: {stats.blocksFound} expired email blocks</p>
              {!stats.dryRun && (
                <p>• Deleted: {stats.blocksDeleted} expired blocks</p>
              )}
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

          {showConfirm && stats && stats.blocksFound > 0 && (
            <Button
              variant="default"
              onClick={handleExecute}
              disabled={loading}
            >
              {loading ? 'Executing...' : `Delete ${stats.blocksFound} Expired Blocks`}
            </Button>
          )}
        </div>

        <div className="text-xs text-gray-500 space-y-1">
          <p>ℹ️ This action will:</p>
          <ul className="list-disc list-inside ml-2 space-y-1">
            <li>Delete expired email blocks from blocked_emails table</li>
            <li>Allow previously blocked emails to sign up again</li>
            <li>Log the cleanup action in audit logs</li>
          </ul>
          <p className="font-medium">Always preview before executing!</p>
        </div>
      </CardContent>
    </Card>
  )
}
