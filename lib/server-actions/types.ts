import { z } from 'zod'

/**
 * Server Action Result
 * Consistent return type for all server actions
 */
export type ActionResult<T = any> = {
  success: boolean
  data?: T
  error?: string
  fieldErrors?: Record<string, string[]>
}

/**
 * Server Action Handler
 * Function signature for server action logic
 */
export type ActionHandler<TInput = any, TOutput = any> = (
  input: TInput
) => Promise<TOutput>

/**
 * Action Options
 * Configuration for enhanced server actions
 */
export interface ActionOptions<TInput = any, TOutput = any> {
  name: string
  schema?: z.ZodSchema<TInput>
  handler: ActionHandler<TInput, TOutput>
  auth?: {
    required?: boolean
    adminOnly?: boolean
  }
  rateLimit?: {
    maxRequests: number
    windowMs: number
  }
  logging?: boolean
}

/**
 * Action Context
 * Available context in action handlers
 */
export interface ActionContext {
  userId?: string
  isAdmin?: boolean
  requestId?: string
}
