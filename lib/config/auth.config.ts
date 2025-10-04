import { z } from 'zod'

/**
 * Authentication Configuration Schema
 * Validates auth-related environment variables
 */

const AuthConfigSchema = z.object({
  providers: z.object({
    password: z.boolean(),
    google: z.boolean(),
    magicLink: z.boolean(),
  }),
  session: z.object({
    cookieName: z.string(),
    maxAge: z.number().positive(),
  }),
  callbacks: z.object({
    signIn: z.string(),
    signOut: z.string(),
    error: z.string(),
  }),
})

/**
 * Parse and validate auth configuration
 */
export const authConfig = AuthConfigSchema.parse({
  providers: {
    password: true,
    google: true,
    magicLink: false,
  },
  session: {
    cookieName: 'promptok-session',
    maxAge: 7 * 24 * 60 * 60, // 7 days in seconds
  },
  callbacks: {
    signIn: '/tools/enhance',
    signOut: '/auth/signin',
    error: '/auth/signin',
  },
})

// Export type
export type AuthConfig = z.infer<typeof AuthConfigSchema>
