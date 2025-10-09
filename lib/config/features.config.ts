import { z } from 'zod'

/**
 * Feature Flags Configuration Schema
 * Controls which features are enabled/disabled
 */

const FeaturesConfigSchema = z.object({
  analytics: z.object({
    enabled: z.boolean(),
    trackPageViews: z.boolean(),
    trackEvents: z.boolean(),
  }),
  versionUpdater: z.object({
    enabled: z.boolean(),
    intervalSeconds: z.number().min(10).max(3600),
  }),
  billing: z.object({
    enabled: z.boolean(),
    allowTrials: z.boolean(),
  }),
  guestAccess: z.object({
    enabled: z.boolean(),
    maxSessions: z.number().min(1),
  }),
  rateLimit: z.object({
    enabled: z.boolean(),
    requestsPerMinute: z.number().min(1),
  }),
  darkMode: z.object({
    enabled: z.boolean(),
    defaultMode: z.enum(['light', 'dark', 'system']),
  }),
  maintenance: z.object({
    enabled: z.boolean(),
    message: z.string().optional(),
  }),
})

/**
 * Parse and validate feature flags
 */
export const featuresConfig = FeaturesConfigSchema.parse({
  analytics: {
    enabled: process.env.NODE_ENV === 'production',
    trackPageViews: true,
    trackEvents: true,
  },
  versionUpdater: {
    enabled: false, // Disabled - /version endpoint not implemented yet
    intervalSeconds: Number(process.env.NEXT_PUBLIC_VERSION_UPDATER_REFETCH_INTERVAL_SECONDS) || 120,
  },
  billing: {
    enabled: Boolean(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY),
    allowTrials: true,
  },
  guestAccess: {
    enabled: true,
    maxSessions: 5,
  },
  rateLimit: {
    enabled: Boolean(process.env.UPSTASH_REDIS_REST_URL),
    requestsPerMinute: 60,
  },
  darkMode: {
    enabled: true,
    defaultMode: 'system',
  },
  maintenance: {
    enabled: process.env.NEXT_PUBLIC_MAINTENANCE_MODE === 'true',
    message: process.env.NEXT_PUBLIC_MAINTENANCE_MESSAGE,
  },
})

// Export type
export type FeaturesConfig = z.infer<typeof FeaturesConfigSchema>
