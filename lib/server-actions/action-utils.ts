import { ActionResult } from './types'

/**
 * Create success result
 */
export function success<T>(data: T): ActionResult<T> {
  return {
    success: true,
    data,
  }
}

/**
 * Create error result
 */
export function error(message: string, fieldErrors?: Record<string, string[]>): ActionResult {
  return {
    success: false,
    error: message,
    fieldErrors,
  }
}

/**
 * Type guard to check if result is successful
 */
export function isSuccess<T>(result: ActionResult<T>): result is ActionResult<T> & { success: true; data: T } {
  return result.success === true
}

/**
 * Type guard to check if result is an error
 */
export function isError<T>(result: ActionResult<T>): result is ActionResult<T> & { success: false; error: string } {
  return result.success === false
}

/**
 * Handle action result in client component
 */
export function handleActionResult<T>(
  result: ActionResult<T>,
  callbacks: {
    onSuccess?: (data: T) => void
    onError?: (error: string) => void
    onFieldErrors?: (errors: Record<string, string[]>) => void
  }
): void {
  if (isSuccess(result)) {
    callbacks.onSuccess?.(result.data)
  } else {
    if (result.fieldErrors) {
      callbacks.onFieldErrors?.(result.fieldErrors)
    }
    if (result.error) {
      callbacks.onError?.(result.error)
    }
  }
}
