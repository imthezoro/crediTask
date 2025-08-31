// Centralized authentication error handling utility
export const AuthErrors = {
  // Error codes for consistent handling
  ACCOUNT_DEACTIVATED: 'ACCOUNT_DEACTIVATED',
  ACCOUNT_VERIFICATION_FAILED: 'ACCOUNT_VERIFICATION_FAILED',
  AUTHENTICATION_FAILED: 'AUTHENTICATION_FAILED',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
} as const

export type AuthErrorCode = typeof AuthErrors[keyof typeof AuthErrors]

// User-friendly error messages
export const AUTH_ERROR_MESSAGES: Record<AuthErrorCode, string> = {
  [AuthErrors.ACCOUNT_DEACTIVATED]: 'Your account has been deactivated. Please create a new account to continue.',
  [AuthErrors.ACCOUNT_VERIFICATION_FAILED]: 'Unable to verify your account. Please try signing in again.',
  [AuthErrors.AUTHENTICATION_FAILED]: 'Authentication failed. Please try again.',
  [AuthErrors.INVALID_CREDENTIALS]: 'Invalid email or password. Please check your credentials and try again.',
  [AuthErrors.RATE_LIMIT_EXCEEDED]: 'Too many attempts. Please wait a moment before trying again.',
}

// Error types for UI styling
export const AUTH_ERROR_TYPES: Record<AuthErrorCode, 'error' | 'warning'> = {
  [AuthErrors.ACCOUNT_DEACTIVATED]: 'error',
  [AuthErrors.ACCOUNT_VERIFICATION_FAILED]: 'warning',
  [AuthErrors.AUTHENTICATION_FAILED]: 'error',
  [AuthErrors.INVALID_CREDENTIALS]: 'error',
  [AuthErrors.RATE_LIMIT_EXCEEDED]: 'warning',
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

  // Handle legacy error messages
  const lowerError = errorCode.toLowerCase()
  
  if (lowerError.includes('account is not active') || lowerError.includes('deactivated')) {
    return {
      message: AUTH_ERROR_MESSAGES[AuthErrors.ACCOUNT_DEACTIVATED],
      type: AUTH_ERROR_TYPES[AuthErrors.ACCOUNT_DEACTIVATED],
      code: AuthErrors.ACCOUNT_DEACTIVATED,
    }
  }
  
  if (lowerError.includes('verification failed') || lowerError.includes('account verification')) {
    return {
      message: AUTH_ERROR_MESSAGES[AuthErrors.ACCOUNT_VERIFICATION_FAILED],
      type: AUTH_ERROR_TYPES[AuthErrors.ACCOUNT_VERIFICATION_FAILED],
      code: AuthErrors.ACCOUNT_VERIFICATION_FAILED,
    }
  }
  
  if (lowerError.includes('invalid') || lowerError.includes('credentials')) {
    return {
      message: AUTH_ERROR_MESSAGES[AuthErrors.INVALID_CREDENTIALS],
      type: AUTH_ERROR_TYPES[AuthErrors.INVALID_CREDENTIALS],
      code: AuthErrors.INVALID_CREDENTIALS,
    }
  }
  
  if (lowerError.includes('rate limit') || lowerError.includes('too many')) {
    return {
      message: AUTH_ERROR_MESSAGES[AuthErrors.RATE_LIMIT_EXCEEDED],
      type: AUTH_ERROR_TYPES[AuthErrors.RATE_LIMIT_EXCEEDED],
      code: AuthErrors.RATE_LIMIT_EXCEEDED,
    }
  }

  // Fallback for unknown errors
  return {
    message: errorCode || 'An unexpected error occurred. Please try again.',
    type: 'error',
    code: null,
  }
}

// Helper to create error URL parameters
export function createErrorUrl(baseUrl: string, errorCode: AuthErrorCode): string {
  return `${baseUrl}?error=${encodeURIComponent(errorCode)}`
}
