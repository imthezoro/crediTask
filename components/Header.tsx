'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LogoutButton } from '@/components/auth/logout-button'
import { Button } from '@/components/ui/button'

interface HeaderProps {
  user?: {
    id: string
    email?: string
  } | null
  isAdmin?: boolean
  pageTitle?: string
  showNavigation?: boolean
}

const userNavItems = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/billing', label: 'Billing' },
  { href: '/settings', label: 'Settings' },
]

const adminNavItems = [
  { href: '/admin/dashboard', label: 'Dashboard' },
  { href: '/admin/users', label: 'Users' },
  { href: '/admin/payments', label: 'Payments' },
  { href: '/admin/analytics', label: 'Analytics' },
  { href: '/admin/alerts', label: 'Alerts' },
]

export default function Header({ user, isAdmin, pageTitle, showNavigation = true }: HeaderProps) {
  const pathname = usePathname()
  const isAdminPage = pathname?.startsWith('/admin')
  const navItems = isAdminPage ? adminNavItems : userNavItems

  // Don't show navigation on auth pages
  const isAuthPage = pathname?.startsWith('/auth')
  const shouldShowNav = showNavigation && !isAuthPage && user

  return (
    <header className="bg-white shadow-sm border-b border-gray-200">
      <div className="container mx-auto px-4 py-4">
        <div className="flex justify-between items-center">
          {/* Left: PromptOK Logo/Name */}
          <Link 
            href="/" 
            className="text-2xl font-bold text-blue-600 hover:text-blue-700 transition-colors"
          >
            PromptOK
          </Link>

          {/* Center: Page Title */}
          {pageTitle && (
            <h1 className="text-xl font-semibold text-gray-900 hidden sm:block">
              {pageTitle}
            </h1>
          )}

          {/* Right: Navigation */}
          <div className="flex items-center space-x-4">
            {shouldShowNav ? (
              <>
                {/* Navigation Links */}
                <nav className="hidden md:flex items-center space-x-4">
                  {navItems.map((item) => {
                    const isActive = pathname === item.href
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={`transition-colors ${
                          isActive
                            ? 'text-blue-700 font-semibold'
                            : 'text-blue-600 hover:text-blue-700'
                        }`}
                      >
                        {item.label}
                      </Link>
                    )
                  })}
                  
                  {/* Admin Access for Regular Users */}
                  {!isAdminPage && isAdmin && (
                    <Link 
                      href="/admin/dashboard" 
                      className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded-md text-sm font-medium transition-colors"
                    >
                      Admin
                    </Link>
                  )}
                  
                  {/* Back to Dashboard for Admin Users */}
                  {isAdminPage && (
                    <Link 
                      href="/dashboard" 
                      className="bg-blue-50 hover:bg-blue-100 text-blue-700 px-3 py-1 rounded-md text-sm font-medium border border-blue-200 transition-colors"
                    >
                      Back to Dashboard
                    </Link>
                  )}
                </nav>

                {/* Mobile Menu Button */}
                <div className="md:hidden">
                  <MobileMenu 
                    navItems={navItems} 
                    isAdmin={isAdmin} 
                    isAdminPage={isAdminPage}
                    pathname={pathname}
                  />
                </div>

                {/* Logout Button */}
                <LogoutButton />
              </>
            ) : !user ? (
              /* Public Navigation */
              <nav className="flex items-center space-x-4">
                <Link href="/pricing" className="text-gray-600 hover:text-blue-600 transition-colors">
                  Pricing
                </Link>
                <Link href="/auth/signin" className="text-blue-600 hover:text-blue-700 transition-colors">
                  Sign In
                </Link>
                <Link 
                  href="/auth/signup" 
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Sign Up
                </Link>
              </nav>
            ) : null}
          </div>
        </div>
      </div>
    </header>
  )
}

interface MobileMenuProps {
  navItems: Array<{ href: string; label: string }>
  isAdmin?: boolean
  isAdminPage: boolean
  pathname: string | null
}

function MobileMenu({ navItems, isAdmin, isAdminPage, pathname }: MobileMenuProps) {
  return (
    <div className="relative group">
      <Button variant="outline" size="sm" className="md:hidden">
        Menu
      </Button>
      
      {/* Dropdown Menu */}
      <div className="absolute right-0 top-full mt-2 w-48 bg-white border border-gray-200 rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
        <div className="py-2">
          {navItems.map((item) => {
            const isActive = pathname === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`block px-4 py-2 text-sm transition-colors ${
                  isActive
                    ? 'text-blue-700 font-semibold bg-blue-50'
                    : 'text-gray-700 hover:text-blue-700 hover:bg-gray-50'
                }`}
              >
                {item.label}
              </Link>
            )
          })}
          
          {/* Admin/Dashboard Switch */}
          {!isAdminPage && isAdmin && (
            <Link 
              href="/admin/dashboard" 
              className="block px-4 py-2 text-sm text-red-600 hover:text-red-700 hover:bg-red-50 transition-colors border-t border-gray-100 mt-2 pt-2"
            >
              Admin Panel
            </Link>
          )}
          
          {isAdminPage && (
            <Link 
              href="/dashboard" 
              className="block px-4 py-2 text-sm text-blue-600 hover:text-blue-700 hover:bg-blue-50 transition-colors border-t border-gray-100 mt-2 pt-2"
            >
              Back to Dashboard
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}
