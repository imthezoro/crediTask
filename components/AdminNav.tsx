'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const items = [
  { href: '/admin', label: 'Dashboard' },
  { href: '/admin/users', label: 'Users' },
  { href: '/admin/payments', label: 'Payments' },
  { href: '/admin/analytics', label: 'Analytics' },
  { href: '/admin/alerts', label: 'Alerts' },
]

export default function AdminNav() {
  const pathname = usePathname()
  return (
    <nav className="space-x-4">
      {items.map((item) => {
        const active = pathname === item.href
        return (
          <Link
            key={item.href}
            href={item.href}
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
  )
}
