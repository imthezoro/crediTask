'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'

const items = [
  { href: '/admin', label: 'Dashboard' },
  { href: '/admin/users', label: 'Users' },
  { href: '/admin/payments', label: 'Payments' },
  { href: '/admin/analytics', label: 'Analytics' },
  { href: '/admin/alerts', label: 'Alerts' },
]

export default function AdminNav() {
  const pathname = usePathname()
  const [loading, setLoading] = useState(false)
  const timeoutRef = useRef<number | null>(null)

  // Stop loading when the new pathname renders
  useEffect(() => {
    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
    // small delay to avoid flicker on fast nav
    timeoutRef.current = window.setTimeout(() => {
      setLoading(false)
    }, 150)
    return () => {
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }
    }
  }, [pathname])

  // Listen for admin data loading events
  useEffect(() => {
    const onStart = () => setLoading(true)
    const onEnd = () => setLoading(false)
    window.addEventListener('admin:loading:start', onStart as EventListener)
    window.addEventListener('admin:loading:end', onEnd as EventListener)
    return () => {
      window.removeEventListener('admin:loading:start', onStart as EventListener)
      window.removeEventListener('admin:loading:end', onEnd as EventListener)
    }
  }, [])

  return (
    <div className="relative">
      {/* Top inline progress bar (subtle, non-blocking) */}
      <div
        className={`absolute -top-2 left-0 right-0 h-0.5 overflow-hidden`}
        aria-hidden="true"
      >
        <div
          className={`h-full bg-blue-600 transition-all duration-200 ease-out ${
            loading ? 'w-full animate-pulse' : 'w-0'
          }`}
        />
      </div>

      <nav className="space-x-4">
        {items.map((item) => {
          const active = pathname === item.href
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setLoading(true)}
              className={
                (active
                  ? 'text-blue-700 font-semibold underline underline-offset-4'
                  : 'text-blue-600 hover:text-blue-700') + ' transition-colors'
              }
            >
              {item.label}
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
