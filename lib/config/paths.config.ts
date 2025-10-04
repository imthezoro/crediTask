/**
 * Application Route Paths Configuration
 * Centralized path definitions for consistent routing
 */

export const pathsConfig = {
  auth: {
    signIn: '/auth/signin',
    signUp: '/auth/signup',
    callback: '/auth/callback',
    forgotPassword: '/auth/forgot-password',
    resetPasswordConfirm: '/auth/reset-password-confirm',
  },
  app: {
    home: '/',
    dashboard: '/dashboard',
    enhance: '/tools/enhance',
    settings: '/settings',
    billing: '/billing',
    contact: '/contact',
    faq: '/faq',
    pricing: '/pricing',
  },
  admin: {
    dashboard: '/admin/dashboard',
    users: '/admin/users',
    analytics: '/admin/analytics',
    alerts: '/admin/alerts',
  },
  legal: {
    privacy: '/privacy',
    terms: '/terms',
    refund: '/refund-policy',
  },
  api: {
    auth: {
      login: '/api/auth/login',
      logout: '/api/auth/logout',
      signup: '/api/auth/signup',
      guestLogin: '/api/auth/guest-login',
      validateSession: '/api/auth/validate-session',
    },
    enhance: '/api/enhance',
    user: {
      profile: '/api/user/profile',
    },
    admin: {
      users: '/api/admin/users',
    },
  },
} as const

// Helper type for autocomplete
export type AppPaths = typeof pathsConfig
