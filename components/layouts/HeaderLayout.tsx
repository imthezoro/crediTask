'use client'

import { ReactNode } from 'react'
import Header from '@/components/Header'

interface HeaderLayoutProps {
  children: ReactNode
}

/**
 * Header Layout Component
 * Traditional top navigation layout
 */
export function HeaderLayout({ children }: HeaderLayoutProps) {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Header />
      <main className="pt-16">
        <div className="p-4 sm:p-6 lg:p-8">
          {children}
        </div>
      </main>
    </div>
  )
}
