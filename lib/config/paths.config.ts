import { z } from 'zod'

/**
 * Application Route Paths Configuration Schema
 * Centralized path definitions for consistent routing with validation
 */

const PathsConfigSchema = z.object({
  auth: z.object({
    signIn: z.string().startsWith('/'),
    signUp: z.string().startsWith('/'),
    callback: z.string().startsWith('/'),
    forgotPassword: z.string().startsWith('/'),
    resetPasswordConfirm: z.string().startsWith('/'),
  }),
  app: z.object({
    home: z.string(),
    dashboard: z.string().startsWith('/'),
    enhance: z.string().startsWith('/'),
    settings: z.string().startsWith('/'),
    billing: z.string().startsWith('/'),
    contact: z.string().startsWith('/'),
    faq: z.string().startsWith('/'),
    pricing: z.string().startsWith('/'),
  }),
  admin: z.object({
    dashboard: z.string().startsWith('/'),
    users: z.string().startsWith('/'),
    analytics: z.string().startsWith('/'),
    alerts: z.string().startsWith('/'),
  }),
  legal: z.object({
    privacy: z.string().startsWith('/'),
    terms: z.string().startsWith('/'),
    refund: z.string().startsWith('/'),
  }),
  api: z.object({
    auth: z.object({
      login: z.string().startsWith('/api'),
      logout: z.string().startsWith('/api'),
      signup: z.string().startsWith('/api'),
      guestLogin: z.string().startsWith('/api'),
      validateSession: z.string().startsWith('/api'),
    }),
    enhance: z.string().startsWith('/api'),
    user: z.object({
      profile: z.string().startsWith('/api'),
    }),
    admin: z.object({
      users: z.string().startsWith('/api'),
    }),
  }),
})

/**
 * Parse and validate paths configuration
 */
export const pathsConfig = PathsConfigSchema.parse({
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
})

// Export type for autocomplete
export type PathsConfig = z.infer<typeof PathsConfigSchema>
