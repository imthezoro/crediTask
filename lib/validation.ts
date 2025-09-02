import { z } from 'zod'

// Email validation schema
export const emailSchema = z
  .string()
  .email('Invalid email format')
  .min(1, 'Email is required')
  .max(254, 'Email too long')

// Password validation schema
export const passwordSchema = z
  .string()
  .min(6, 'Password must be at least 8 characters')
  .max(128, 'Password too long')
  //Enable later in prod TODO
  // .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  // .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  // .regex(/[0-9]/, 'Password must contain at least one number')

// UUID validation schema
export const uuidSchema = z
  .string()
  .uuid('Invalid UUID format')

// Delete account request schema
export const deleteAccountSchema = z.object({
  userId: uuidSchema,
  userEmail: emailSchema,
  isGuest: z.boolean()
})

// Login request schema
export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required')
})

// Password reset request schema
export const resetPasswordSchema = z.object({
  email: emailSchema
})

// Session validation request schema
export const validateSessionSchema = z.object({
  userId: uuidSchema
})

// Set password request schema
export const setPasswordSchema = z.object({
  password: passwordSchema,
  userId: uuidSchema
})

// Signup request schema
export const signupSchema = z.object({
  email: emailSchema,
  password: passwordSchema
})

// Generic API response schema
export const apiResponseSchema = z.object({
  success: z.boolean(),
  message: z.string().optional(),
  error: z.string().optional(),
  data: z.unknown().optional()
})

// Validation helper function
export function validateRequest<T>(schema: z.ZodSchema<T>, data: unknown): {
  success: boolean
  data?: T
  error?: string
} {
  try {
    const parsed = schema.parse(data)
    return { success: true, data: parsed }
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorMessage = error.errors.map(e => e.message).join(', ')
      return { success: false, error: errorMessage }
    }
    return { success: false, error: 'Validation failed' }
  }
}

// Sanitization helpers
export function sanitizeString(input: string): string {
  return input
    .trim()
    .replace(/[<>]/g, '') // Remove potential HTML tags
    .slice(0, 1000) // Limit length
}

export function sanitizeEmail(email: string): string {
  return email.toLowerCase().trim()
}
