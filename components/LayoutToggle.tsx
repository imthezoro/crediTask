'use client'

import { LayoutGrid, LayoutPanelTop } from 'lucide-react'
import { useLayout } from '@/lib/layout/layout-context'
import { Button } from './ui/button'

/**
 * Layout Toggle Component
 * Switch between sidebar and header layouts
 */
export function LayoutToggle() {
  const { layout, toggleLayout } = useLayout()

  return (
    <Button
      onClick={toggleLayout}
      variant="ghost"
      size="sm"
      className="gap-2"
      aria-label={`Switch to ${layout === 'sidebar' ? 'header' : 'sidebar'} layout`}
    >
      {layout === 'sidebar' ? (
        <>
          <LayoutPanelTop className="h-4 w-4" />
          <span className="hidden sm:inline">Header Layout</span>
        </>
      ) : (
        <>
          <LayoutGrid className="h-4 w-4" />
          <span className="hidden sm:inline">Sidebar Layout</span>
        </>
      )}
    </Button>
  )
}
