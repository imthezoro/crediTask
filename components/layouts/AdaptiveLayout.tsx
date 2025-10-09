'use client'

import { ReactNode } from 'react'
import { useLayout } from '@/lib/layout/layout-context'
import { SidebarLayout } from './SidebarLayout'
import { HeaderLayout } from './HeaderLayout'

interface AdaptiveLayoutProps {
  children: ReactNode
  onSignOut?: () => void
  isAdmin?: boolean
}

/**
 * Adaptive Layout Component
 * Switches between sidebar and header layouts based on user preference
 */
export function AdaptiveLayout({ children, onSignOut, isAdmin }: AdaptiveLayoutProps) {
  const { layout } = useLayout()

  if (layout === 'sidebar') {
    return (
      <SidebarLayout onSignOut={onSignOut} isAdmin={isAdmin}>
        {children}
      </SidebarLayout>
    )
  }

  return (
    <HeaderLayout>
      {children}
    </HeaderLayout>
  )
}
