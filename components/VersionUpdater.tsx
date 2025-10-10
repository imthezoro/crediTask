'use client'

import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { RocketIcon, X } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { featuresConfig } from '@/lib/config'

/**
 * Current version of the app that is running
 */
let version: string | null = null

interface VersionUpdaterProps {
  intervalTimeInSecond?: number
}

export function VersionUpdater({ intervalTimeInSecond }: VersionUpdaterProps) {
  // Check if feature is enabled
  if (!featuresConfig.versionUpdater.enabled) {
    return null
  }

  // eslint-disable-next-line react-hooks/rules-of-hooks
  const { data } = useVersionUpdater({ intervalTimeInSecond })
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const [dismissed, setDismissed] = useState(false)
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const [showDialog, setShowDialog] = useState<boolean>(false)

  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => {
    setShowDialog(data?.didChange ?? false)
  }, [data?.didChange])

  if (!data?.didChange || dismissed) {
    return null
  }

  return (
    <Dialog open={showDialog} onOpenChange={setShowDialog}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RocketIcon className="h-5 w-5 text-primary" />
            <span>New Version Available</span>
          </DialogTitle>
          <DialogDescription>
            A new version of PromptOK has been deployed. Refresh your browser to get the latest features and bug fixes.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center space-x-2 rounded-md bg-blue-50 dark:bg-blue-950 p-4">
          <div className="flex-1 space-y-1">
            <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
              What&apos;s new?
            </p>
            <p className="text-sm text-blue-700 dark:text-blue-300">
              Updated features, performance improvements, and bug fixes.
            </p>
          </div>
        </div>

        <DialogFooter className="flex-row gap-2 sm:justify-between">
          <Button
            variant="outline"
            onClick={() => {
              setShowDialog(false)
              setDismissed(true)
            }}
            className="flex-1 sm:flex-none"
          >
            <X className="h-4 w-4 mr-2" />
            Dismiss
          </Button>

          <Button
            onClick={() => window.location.reload()}
            className="flex-1 sm:flex-none"
          >
            <RocketIcon className="h-4 w-4 mr-2" />
            Refresh Now
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function useVersionUpdater(props: { intervalTimeInSecond?: number } = {}) {
  // Use config value or provided override
  const configInterval = featuresConfig.versionUpdater.intervalSeconds
  const refetchInterval = (props.intervalTimeInSecond ?? configInterval) * 1000

  // Start fetching new version after half of the interval time
  const staleTime = refetchInterval / 2

  return useQuery({
    queryKey: ['version-updater'],
    staleTime,
    gcTime: refetchInterval,
    refetchIntervalInBackground: true,
    refetchInterval,
    queryFn: async () => {
      try {
        const response = await fetch('/version')
        const currentVersion = await response.text()
        const oldVersion = version

        version = currentVersion

        const didChange = oldVersion !== null && currentVersion !== oldVersion

        if (didChange) {
          console.log('[VersionUpdater] New version detected:', {
            old: oldVersion,
            new: currentVersion,
          })
        }

        return {
          currentVersion,
          oldVersion,
          didChange,
        }
      } catch (error) {
        console.error('[VersionUpdater] Failed to check version:', error)
        return {
          currentVersion: version || 'unknown',
          oldVersion: version,
          didChange: false,
        }
      }
    },
  })
}
