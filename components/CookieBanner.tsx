'use client'

import { useState, useEffect } from 'react'
import { X, Cookie } from 'lucide-react'
import { Button } from './ui/button'
import { Card } from './ui/card'

const COOKIE_CONSENT_KEY = 'promptok-cookie-consent'

export type CookieConsent = 'accepted' | 'rejected' | null

/**
 * Cookie Banner Component
 * GDPR-compliant cookie consent banner
 */
export function CookieBanner() {
  const [consent, setConsent] = useState<CookieConsent>(null)
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    // Check if user has already made a choice
    const savedConsent = localStorage.getItem(COOKIE_CONSENT_KEY)
    
    if (savedConsent === 'accepted' || savedConsent === 'rejected') {
      setConsent(savedConsent as CookieConsent)
      setIsVisible(false)
    } else {
      // Show banner after short delay
      const timer = setTimeout(() => {
        setIsVisible(true)
      }, 1000)
      return () => clearTimeout(timer)
    }
  }, [])

  const handleAccept = () => {
    localStorage.setItem(COOKIE_CONSENT_KEY, 'accepted')
    setConsent('accepted')
    setIsVisible(false)
    
    // Enable analytics if you have them
    // window.gtag?.('consent', 'update', { analytics_storage: 'granted' })
  }

  const handleReject = () => {
    localStorage.setItem(COOKIE_CONSENT_KEY, 'rejected')
    setConsent('rejected')
    setIsVisible(false)
    
    // Disable analytics
    // window.gtag?.('consent', 'update', { analytics_storage: 'denied' })
  }

  if (!isVisible) return null

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4 sm:p-6 pointer-events-none">
      <div className="max-w-7xl mx-auto pointer-events-auto">
        <Card className="bg-white dark:bg-gray-800 shadow-lg border border-gray-200 dark:border-gray-700">
          <div className="p-4 sm:p-6">
            <div className="flex items-start gap-4">
              {/* Cookie Icon */}
              <div className="flex-shrink-0 mt-1">
                <Cookie className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  Cookie Consent
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
                  We use essential cookies to ensure our website functions properly and to provide you with the best experience. 
                  By clicking "Accept", you consent to our use of cookies for authentication and session management.
                  {' '}
                  <a 
                    href="/legal/privacy" 
                    className="text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    Learn more
                  </a>
                </p>

                {/* Actions */}
                <div className="flex flex-wrap gap-3">
                  <Button
                    onClick={handleAccept}
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    Accept Cookies
                  </Button>
                  <Button
                    onClick={handleReject}
                    variant="outline"
                    className="border-gray-300 dark:border-gray-600"
                  >
                    Reject Non-Essential
                  </Button>
                </div>
              </div>

              {/* Close Button */}
              <button
                onClick={handleReject}
                className="flex-shrink-0 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                aria-label="Close cookie banner"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}

/**
 * Hook to check cookie consent status
 */
export function useCookieConsent(): CookieConsent {
  const [consent, setConsent] = useState<CookieConsent>(null)

  useEffect(() => {
    const savedConsent = localStorage.getItem(COOKIE_CONSENT_KEY)
    if (savedConsent === 'accepted' || savedConsent === 'rejected') {
      setConsent(savedConsent as CookieConsent)
    }
  }, [])

  return consent
}

/**
 * Check if user has accepted cookies
 */
export function hasAcceptedCookies(): boolean {
  if (typeof window === 'undefined') return false
  return localStorage.getItem(COOKIE_CONSENT_KEY) === 'accepted'
}

/**
 * Reset cookie consent (for testing)
 */
export function resetCookieConsent(): void {
  if (typeof window === 'undefined') return
  localStorage.removeItem(COOKIE_CONSENT_KEY)
  window.location.reload()
}
