'use client'

import { ReactNode, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { 
  LayoutGrid, 
  Users, 
  Settings, 
  LogOut,
  Menu,
  X,
  Sparkles,
  BarChart3
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface SidebarLayoutProps {
  children: ReactNode
  onSignOut?: () => void
  isAdmin?: boolean
}

interface NavItem {
  label: string
  href: string
  icon: any
  adminOnly?: boolean
}

const navItems: NavItem[] = [
  { label: 'Enhance', href: '/tools/enhance', icon: Sparkles },
  { label: 'Dashboard', href: '/dashboard', icon: LayoutGrid },
  { label: 'Analytics', href: '/dashboard/analytics', icon: BarChart3 },
  { label: 'Admin', href: '/admin/dashboard', icon: Users, adminOnly: true },
  { label: 'Settings', href: '/settings', icon: Settings },
]

export function SidebarLayout({ children, onSignOut, isAdmin = false }: SidebarLayoutProps) {
  const pathname = usePathname()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  const filteredNavItems = navItems.filter(item => !item.adminOnly || isAdmin)

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-40 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between p-4">
          <Link href="/" className="text-xl font-bold text-blue-600">
            PromptOK
          </Link>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          >
            {isMobileMenuOpen ? (
              <X className="h-6 w-6" />
            ) : (
              <Menu className="h-6 w-6" />
            )}
          </Button>
        </div>
      </div>

      {/* Sidebar - Right Side */}
      <aside
        className={cn(
          'fixed top-0 right-0 z-40 h-screen w-64 bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 transition-transform',
          'lg:translate-x-0',
          isMobileMenuOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'
        )}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
            <Link href="/" className="text-xl font-bold text-blue-600">
              PromptOK
            </Link>
            <Button
              variant="ghost"
              size="sm"
              className="lg:hidden"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              <X className="h-5 w-5" />
            </Button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto p-4 space-y-2">
            {filteredNavItems.map((item) => {
              const Icon = item.icon
              const isActive = pathname === item.href || pathname?.startsWith(item.href + '/')

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={cn(
                    'flex items-center gap-3 px-4 py-3 rounded-lg transition-colors',
                    isActive
                      ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                  )}
                >
                  <Icon className="h-5 w-5" />
                  <span className="font-medium">{item.label}</span>
                </Link>
              )
            })}
          </nav>

          {/* Sign Out */}
          {onSignOut && (
            <div className="p-4 border-t border-gray-200 dark:border-gray-700">
              <Button
                onClick={onSignOut}
                variant="ghost"
                className="w-full justify-start gap-3 text-gray-700 dark:text-gray-300"
              >
                <LogOut className="h-5 w-5" />
                Sign Out
              </Button>
            </div>
          )}
        </div>
      </aside>

      {/* Mobile Overlay */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Main Content */}
      <main className="lg:pr-64 pt-16 lg:pt-0">
        <div className="p-4 sm:p-6 lg:p-8">
          {children}
        </div>
      </main>
    </div>
  )
}
