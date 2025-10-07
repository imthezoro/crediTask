import { z } from 'zod'

/**
 * Application Configuration Schema
 * Validates environment variables at build time to catch errors early
 * Based on reference: nextjs-saas-starter-kit-lite app.config.ts
 */

const AppConfigSchema = z.object({
  name: z.string().min(1, 'Application name is required'),
  url: z.string().url('Valid URL is required'),
  production: z.boolean(),
  supabase: z.object({
    url: z.string().url('Valid Supabase URL is required'),
    anonKey: z.string().min(1, 'Supabase anon key is required'),
  }),
  openai: z.object({
    apiKey: z.string().optional(),
  }),
  stripe: z.object({
    publishableKey: z.string().optional(),
    secretKey: z.string().optional(),
    webhookSecret: z.string().optional(),
  }),
  redis: z.object({
    url: z.string().optional(),
    token: z.string().optional(),
  }),
}).refine(
  (schema) => {
    // In production, URL must use HTTPS except for local builds
    if (schema.production && !schema.url.startsWith('https://')) {
      try {
        const parsed = new URL(schema.url)
        const isLocalHost = parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1'
        if (!isLocalHost) {
          return false
        }
      } catch {
        return false
      }
    }
    return true
  },
  {
    message: 'Production URL must use HTTPS',
    path: ['url'],
  }
)

/**
 * Parse and validate environment variables
 * Throws error at build time if configuration is invalid
 */
export const appConfig = AppConfigSchema.parse({
  name: process.env.NEXT_PUBLIC_PRODUCT_NAME || 'PromptOK',
  url: process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000',
  production: process.env.NODE_ENV === 'production',
  supabase: {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL!,
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  },
  openai: {
    apiKey: process.env.OPENAI_API_KEY,
  },
  stripe: {
    publishableKey: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
    secretKey: process.env.STRIPE_SECRET_KEY,
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
  },
  redis: {
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  },
})

// Export type for use in components
export type AppConfig = z.infer<typeof AppConfigSchema>
