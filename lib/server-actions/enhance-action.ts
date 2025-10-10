import { createLogger } from '../logger'
import { ActionResult, ActionOptions, ActionContext } from './types'

const logger = createLogger({ prefix: 'ServerAction' })

/**
 * Enhanced Server Action Wrapper
 * Provides validation, error handling, logging, and auth checks
 */
export function enhanceAction<TInput = unknown, TOutput = unknown>(
  options: ActionOptions<TInput, TOutput>
) {
  const actionLogger = logger.child(options.name)

  return async function action(
    input: TInput
  ): Promise<ActionResult<TOutput>> {
    const startTime = Date.now()
    const requestId = generateRequestId()

    try {
      actionLogger.debug('Action started', { requestId })

      // 1. Validate input with Zod schema
      let validatedInput = input
      if (options.schema) {
        const validation = options.schema.safeParse(input)
        
        if (!validation.success) {
          const fieldErrors = validation.error.flatten().fieldErrors
          actionLogger.warn('Validation failed', { 
            requestId, 
            fieldErrors 
          })
          
          return {
            success: false,
            error: 'Validation failed',
            fieldErrors: fieldErrors as Record<string, string[]>,
          }
        }
        
        validatedInput = validation.data
      }

      // 2. Check authentication (if required)
      if (options.auth?.required) {
        const context = await getActionContext()
        
        if (!context.userId) {
          actionLogger.warn('Authentication required', { requestId })
          return {
            success: false,
            error: 'Authentication required',
          }
        }

        // 3. Check admin access (if required)
        if (options.auth.adminOnly && !context.isAdmin) {
          actionLogger.warn('Admin access required', { 
            requestId, 
            userId: context.userId 
          })
          return {
            success: false,
            error: 'Admin access required',
          }
        }
      }

      // 4. Execute the action handler
      const result = await options.handler(validatedInput)
      
      const duration = Date.now() - startTime
      if (options.logging !== false) {
        actionLogger.info('Action completed', { 
          requestId, 
          duration 
        })
      }

      return {
        success: true,
        data: result,
      }
    } catch (error) {
      const duration = Date.now() - startTime
      
      actionLogger.error('Action failed', {
        requestId,
        duration,
        error,
        errorMessage: error instanceof Error ? error.message : String(error),
      })

      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      }
    }
  }
}

/**
 * Get action context (user info, etc.)
 * This would integrate with your auth system
 */
async function getActionContext(): Promise<ActionContext> {
  // TODO: Implement actual auth context retrieval
  // This is a placeholder - you'll need to integrate with your Supabase auth
  
  try {
    // Example: Get user from cookies/session
    // const supabase = createServerClient(...)
    // const { data: { user } } = await supabase.auth.getUser()
    // const profile = await getProfile(user.id)
    
    return {
      userId: undefined,
      isAdmin: false,
      requestId: generateRequestId(),
    }
  } catch {
    return {
      requestId: generateRequestId(),
    }
  }
}

/**
 * Generate unique request ID
 */
function generateRequestId(): string {
  return `act_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}
