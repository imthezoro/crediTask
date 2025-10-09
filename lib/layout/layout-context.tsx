'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'

export type LayoutType = 'sidebar' | 'header'

interface LayoutContextType {
  layout: LayoutType
  setLayout: (layout: LayoutType) => void
  toggleLayout: () => void
}

const LayoutContext = createContext<LayoutContextType | undefined>(undefined)

const LAYOUT_STORAGE_KEY = 'promptok-layout-preference'

/**
 * Layout Provider
 * Manages layout preference (sidebar vs header)
 */
export function LayoutProvider({ children }: { children: ReactNode }) {
  const [layout, setLayoutState] = useState<LayoutType>('header')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    
    // Load layout preference from localStorage
    const savedLayout = localStorage.getItem(LAYOUT_STORAGE_KEY)
    if (savedLayout === 'sidebar' || savedLayout === 'header') {
      setLayoutState(savedLayout)
    }
  }, [])

  const setLayout = (newLayout: LayoutType) => {
    setLayoutState(newLayout)
    localStorage.setItem(LAYOUT_STORAGE_KEY, newLayout)
  }

  const toggleLayout = () => {
    const newLayout = layout === 'sidebar' ? 'header' : 'sidebar'
    setLayout(newLayout)
  }

  // Prevent hydration mismatch
  if (!mounted) {
    return <>{children}</>
  }

  return (
    <LayoutContext.Provider value={{ layout, setLayout, toggleLayout }}>
      {children}
    </LayoutContext.Provider>
  )
}

/**
 * Hook to use layout context
 */
export function useLayout() {
  const context = useContext(LayoutContext)
  if (!context) {
    throw new Error('useLayout must be used within LayoutProvider')
  }
  return context
}
