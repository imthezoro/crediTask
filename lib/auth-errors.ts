// Centralized authentication error handling utility
export const AuthErrors = {
  // Error codes for consistent handling
  ACCOUNT_DEACTIVATED: 'ACCOUNT_DEACTIVATED',
  ACCOUNT_VERIFICATION_FAILED: 'ACCOUNT_VERIFICATION_FAILED',
  AUTHENTICATION_FAILED: 'AUTHENTICATION_FAILED',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  // New generic error for security
  GENERIC_AUTH_ERROR: 'GENERIC_AUTH_ERROR',
} as const

export type AuthErrorCode = typeof AuthErrors[keyof typeof AuthErrors]

// User-friendly error messages - SECURITY: Generic messages to prevent user enumeration
export const AUTH_ERROR_MESSAGES: Record<AuthErrorCode, string> = {
  [AuthErrors.ACCOUNT_DEACTIVATED]: 'Invalid email or password',
  [AuthErrors.ACCOUNT_VERIFICATION_FAILED]: 'Invalid email or password',
  [AuthErrors.AUTHENTICATION_FAILED]: 'Invalid email or password',
  [AuthErrors.INVALID_CREDENTIALS]: 'Invalid email or password',
  [AuthErrors.RATE_LIMIT_EXCEEDED]: 'Too many attempts. Please wait a moment before trying again.',
  [AuthErrors.GENERIC_AUTH_ERROR]: 'Invalid email or password',
}

// Error types for UI styling
export const AUTH_ERROR_TYPES: Record<AuthErrorCode, 'error' | 'warning'> = {
  [AuthErrors.ACCOUNT_DEACTIVATED]: 'error',
  [AuthErrors.ACCOUNT_VERIFICATION_FAILED]: 'error',
  [AuthErrors.AUTHENTICATION_FAILED]: 'error',
  [AuthErrors.INVALID_CREDENTIALS]: 'error',
  [AuthErrors.RATE_LIMIT_EXCEEDED]: 'warning',
  [AuthErrors.GENERIC_AUTH_ERROR]: 'error',
}

// Helper function to get error details
export function getAuthErrorDetails(errorCode: string): {
  message: string
  type: 'error' | 'warning'
  code: AuthErrorCode | null
} {
  // Check if it's a known error code
  if (Object.values(AuthErrors).includes(errorCode as AuthErrorCode)) {
    const code = errorCode as AuthErrorCode
    return {
      message: AUTH_ERROR_MESSAGES[code],
      type: AUTH_ERROR_TYPES[code],
      code,
    }
  }

  // Handle legacy error messages - SECURITY: Always return generic messages
  const lowerError = errorCode.toLowerCase()
  
  // Only allow rate limit errors to be specific for UX
  if (lowerError.includes('rate limit') || lowerError.includes('too many')) {
    return {
      message: AUTH_ERROR_MESSAGES[AuthErrors.RATE_LIMIT_EXCEEDED],
      type: AUTH_ERROR_TYPES[AuthErrors.RATE_LIMIT_EXCEEDED],
      code: AuthErrors.RATE_LIMIT_EXCEEDED,
    }
  }

  // All other authentication errors return generic message to prevent enumeration
  return {
    message: AUTH_ERROR_MESSAGES[AuthErrors.GENERIC_AUTH_ERROR],
    type: AUTH_ERROR_TYPES[AuthErrors.GENERIC_AUTH_ERROR],
    code: AuthErrors.GENERIC_AUTH_ERROR,
  }
}

// Helper to create error URL parameters
export function createErrorUrl(baseUrl: string, errorCode: AuthErrorCode): string {
  return `${baseUrl}?error=${encodeURIComponent(errorCode)}`
}
