'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { Menu, X } from 'lucide-react'
import { LogoutButton } from '@/components/auth/logout-button'
import { useScrollPosition } from '@/hooks/useScrollPosition'

interface HeaderProps {
  user?: {
    id: string
    email?: string
  } | null
  isAdmin?: boolean
  pageTitle?: string
  showNavigation?: boolean
  forcePublicNav?: boolean
  offsetWithSidebar?: boolean
}

const userNavItems = [
  { href: '/tools/enhance', label: 'Enhance Prompts' },
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

export default function Header({ user, isAdmin, pageTitle, showNavigation = true, forcePublicNav = false, offsetWithSidebar = false }: HeaderProps) {
  const pathname = usePathname()
  const { isScrolled } = useScrollPosition()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const isAdminPage = pathname?.startsWith('/admin')
  const navItems = isAdminPage ? adminNavItems : userNavItems
  const isLandingPage = pathname === '/'
  const isAuthPage = pathname?.startsWith('/auth')
  const shouldShowNav = showNavigation && !isAuthPage && user
  const leftClass = offsetWithSidebar ? 'left-[var(--sidebar-current-width)]' : 'left-0'

  // Early return for forcePublicNav
  if (forcePublicNav) {
    return (
      <header className={`fixed top-0 ${leftClass} right-0 z-[999] transition-all duration-300 ${
        isLandingPage
          ? isScrolled
            ? 'bg-white/70 backdrop-blur-md backdrop-saturate-150 border-b border-blue-200/40'
            : 'bg-blue-50 shadow-sm border-b border-blue-200/50'
          : 'bg-white shadow-sm border-b border-gray-200'
      }`}>
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 md:px-6 lg:px-8">
          <Link 
            href="/" 
            className={`text-xl font-bold tracking-tight transition-colors text-slate-900 hover:text-slate-700`}
          >
            PromptOK
          </Link>

          {pageTitle && (
            <h1 className="text-xl font-semibold hidden sm:block transition-colors text-gray-900">
              {pageTitle}
            </h1>
          )}

          <nav className="hidden gap-6 md:flex">
            <Link href="/pricing" className={`text-sm font-medium transition-colors text-gray-700 hover:text-blue-600`}>
              Pricing
            </Link>
            <Link href="/faq" className={`text-sm font-medium transition-colors text-gray-700 hover:text-blue-600`}>
              FAQ
            </Link>
            <Link href="/contact" className={`text-sm font-medium transition-colors text-gray-700 hover:text-blue-600`}>
              Contact
            </Link>
            <Link href="/terms" className={`text-sm font-medium transition-colors text-gray-700 hover:text-blue-600`}>
              Terms
            </Link>
          </nav>

          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className={`rounded-md p-2 md:hidden transition-colors text-gray-700 hover:bg-gray-100`}
          >
            {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>

        {mobileMenuOpen && (
          <div className={`md:hidden border-t px-4 py-3 ${
            isLandingPage
              ? isScrolled
                ? 'bg-white/70 backdrop-blur-md backdrop-saturate-150 border-b border-blue-200/40'
                : 'bg-blue-50 border-blue-200/50'
              : 'bg-white border-gray-200'
          }`}>
            <nav className="flex flex-col gap-3">
              <Link href="/pricing" className={`text-sm font-medium transition-colors text-gray-700 hover:text-blue-600`} onClick={() => setMobileMenuOpen(false)}>
                Pricing
              </Link>
              <Link href="/faq" className={`text-sm font-medium transition-colors text-gray-700 hover:text-blue-600`} onClick={() => setMobileMenuOpen(false)}>
                FAQ
              </Link>
              <Link href="/contact" className={`text-sm font-medium transition-colors text-gray-700 hover:text-blue-600`} onClick={() => setMobileMenuOpen(false)}>
                Contact
              </Link>
              <Link href="/terms" className={`text-sm font-medium transition-colors text-gray-700 hover:text-blue-600`} onClick={() => setMobileMenuOpen(false)}>
                Terms
              </Link>
            </nav>
          </div>
        )}
      </header>
    )
  }

  return (
    <header className={`fixed top-0 ${leftClass} right-0 z-[999] transition-all duration-300 ${
      isLandingPage
        ? isScrolled
          ? 'bg-white/70 backdrop-blur-md backdrop-saturate-150 border-b border-blue-200/40'
          : 'bg-blue-50 shadow-sm border-b border-blue-200/50'
        : 'bg-white shadow-sm border-b border-gray-200'
    }`}>
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 md:px-6 lg:px-8">
        <Link 
          href="/" 
          className={`text-xl font-bold tracking-tight transition-colors ${
            isLandingPage 
              ? 'text-slate-900 hover:text-slate-700' 
              : 'text-gray-900 hover:text-gray-700'
          }`}
        >
          PromptOK
        </Link>

        {pageTitle && (
          <h1 className="text-xl font-semibold hidden sm:block transition-colors text-gray-900">
            {pageTitle}
          </h1>
        )}

        <div className="flex items-center space-x-4">
          {shouldShowNav ? (
            <>
              <nav className="hidden md:flex items-center space-x-4">
                {navItems.map((item) => {
                  const isActive = pathname === item.href
                  const isAdminLink = item.href.startsWith('/admin')
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      prefetch={!isAdminLink} // Disable prefetch for admin routes
                      className={`text-sm font-medium transition-colors ${
                        isActive
                          ? 'text-blue-700 font-semibold'
                          : 'text-gray-700 hover:text-blue-600'
                      }`}
                    >
                      {item.label}
                    </Link>
                  )
                })}
                
                {!isAdminPage && isAdmin && (
                  <Link 
                    href="/admin/dashboard" 
                    prefetch={false}
                    className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded-md text-sm font-medium transition-colors"
                  >
                    Admin
                  </Link>
                )}
                
                {isAdminPage && (
                  <Link 
                    href="/dashboard" 
                    className="bg-blue-50 hover:bg-blue-100 text-blue-700 px-3 py-1 rounded-md text-sm font-medium border border-blue-200 transition-colors"
                  >
                    Back to Dashboard
                  </Link>
                )}
              </nav>

              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="rounded-md p-2 md:hidden transition-colors text-gray-700 hover:bg-gray-100"
              >
                {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
              </button>

              <LogoutButton />
            </>
          ) : (
            <>
              <nav className="hidden md:flex items-center space-x-4">
                <Link href="/pricing" className="text-sm font-medium transition-colors text-gray-700 hover:text-blue-600">
                  Pricing
                </Link>
                <Link href="/faq" className="text-sm font-medium transition-colors text-gray-700 hover:text-blue-600">
                  FAQ
                </Link>
                <Link href="/contact" className="text-sm font-medium transition-colors text-gray-700 hover:text-blue-600">
                  Contact
                </Link>
                <Link href="/terms" className="text-sm font-medium transition-colors text-gray-700 hover:text-blue-600">
                  Terms
                </Link>
              </nav>
              
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className={`rounded-md p-2 md:hidden transition-colors ${
                  isLandingPage && !isScrolled
                    ? 'text-white hover:bg-white/10'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
              </button>
            </>
          )}
        </div>
      </div>
      
      {mobileMenuOpen && (
        <div className={`md:hidden border-t px-4 py-3 ${
          isLandingPage
            ? isScrolled
              ? 'bg-white/70 backdrop-blur-md backdrop-saturate-150 border-b border-blue-200/40'
              : 'bg-blue-50 border-blue-200/50'
            : 'bg-white border-gray-200'
        }`}>
          <nav className="flex flex-col gap-3">
            {shouldShowNav ? (
              <>
                {navItems.map((item) => {
                  const isActive = pathname === item.href
                  const isAdminLink = item.href.startsWith('/admin')
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      prefetch={!isAdminLink}
                      className={`text-sm font-medium transition-colors ${
                        isActive
                          ? 'text-blue-700 font-semibold'
                          : 'text-gray-700 hover:text-blue-600'
                      }`}
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      {item.label}
                    </Link>
                  )
                })}
                
                {!isAdminPage && isAdmin && (
                  <Link 
                    href="/admin/dashboard" 
                    prefetch={false}
                    className={`text-sm font-medium transition-colors border-t pt-3 mt-2 ${
                      isLandingPage && !isScrolled
                        ? 'text-red-300 hover:text-red-200 border-white/20'
                        : 'text-red-600 hover:text-red-700 border-gray-200'
                    }`}
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    Admin Panel
                  </Link>
                )}
                
                {isAdminPage && (
                  <Link 
                    href="/dashboard" 
                    className={`text-sm font-medium transition-colors border-t pt-3 mt-2 ${
                      isLandingPage && !isScrolled
                        ? 'text-blue-300 hover:text-blue-200 border-white/20'
                        : 'text-blue-600 hover:text-blue-700 border-gray-200'
                    }`}
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    Back to Dashboard
                  </Link>
                )}
              </>
            ) : (
              <>
                <Link href="/pricing" className="text-sm font-medium transition-colors text-gray-700 hover:text-blue-600" onClick={() => setMobileMenuOpen(false)}>
                  Pricing
                </Link>
                <Link href="/faq" className="text-sm font-medium transition-colors text-gray-700 hover:text-blue-600" onClick={() => setMobileMenuOpen(false)}>
                  FAQ
                </Link>
                <Link href="/contact" className="text-sm font-medium transition-colors text-gray-700 hover:text-blue-600" onClick={() => setMobileMenuOpen(false)}>
                  Contact
                </Link>
                <Link href="/terms" className="text-sm font-medium transition-colors text-gray-700 hover:text-blue-600" onClick={() => setMobileMenuOpen(false)}>
                  Terms
                </Link>
              </>
            )}
          </nav>
        </div>
      )}
    </header>
  )
}
