# Security Fixes for PromptOK Authentication Service

## Overview
This document outlines the comprehensive security fixes implemented to address critical vulnerabilities in the authentication service.

## Vulnerabilities Fixed

### 1. Guest Account Explosion Prevention
**Issue**: Malicious users could spam guest accounts by clearing localStorage or using incognito mode.

**Solution**:
- Implemented server-side rate limiting via `/api/auth/check-guest-creation` endpoint
- Rate limits: 3 guest accounts per IP per 24 hours, 1 per device per 7 days
- Added system-wide rate limiting (max 10 guests per 5 minutes globally)
- Enhanced the existing Supabase edge function with stricter controls

### 2. Secure Token Storage
**Issue**: Access tokens stored in localStorage vulnerable to XSS attacks.

**Solution**:
- Restructured token storage with expiration metadata
- Implemented automatic token refresh mechanism
- Added token validation before API calls
- Separated access and refresh tokens in different cookies
- Added secure and SameSite attributes to cookies
- Note: Full httpOnly cookies not possible due to extension compatibility requirements

### 3. Eliminated Plaintext Password Storage
**Issue**: Guest passwords stored in plaintext in localStorage.

**Solution**:
- Replaced password storage with secure session tokens
- Store only refresh tokens and user IDs for guest sessions
- Removed `storeGuestAccount()` method that stored plaintext credentials
- Implemented `storeGuestSession()` with encrypted session data

### 4. Race Condition Protection
**Issue**: Multiple tabs could create duplicate guest accounts simultaneously.

**Solution**:
- Implemented localStorage-based locking mechanism
- Added `acquireGuestCreationLock()` and `releaseGuestCreationLock()` methods
- 30-second lock timeout with automatic cleanup
- Proper lock release in try/finally blocks

### 5. Enhanced Extension Messaging Security
**Issue**: Insecure postMessage usage exposing sensitive data.

**Solution**:
- Sanitized session data before sending to extension
- Removed access tokens from postMessage payloads
- Added origin verification in messages
- Implemented proper error handling for messaging failures
- Added security comments for proper extension communication patterns

### 6. Input Validation and XSS Prevention
**Solution**:
- Added `AuthSecurityUtils` class with comprehensive security utilities
- Input sanitization for all user-provided data
- Device ID format validation
- Secure random string generation using crypto.getRandomValues
- Context security validation

## Implementation Details

### New Security Classes and Methods

#### AuthSecurityUtils
- `sanitizeInput()`: XSS prevention through HTML entity encoding
- `isValidDeviceId()`: Validates device ID format and length
- `isSecureContext()`: Checks if running in secure environment
- `generateSecureRandom()`: Cryptographically secure random generation

#### Enhanced AuthService Methods
- `acquireGuestCreationLock()`: Prevents race conditions
- `checkGuestCreationAllowed()`: Server-side rate limit validation
- `validateAndRefreshToken()`: Automatic token management
- `storeGuestSession()`: Secure session storage without passwords

### API Endpoints

#### `/api/auth/check-guest-creation`
- Validates device ID format
- Checks IP and device-based rate limits
- Implements system-wide creation throttling
- Returns detailed error messages for debugging

### Security Configuration

#### Rate Limiting
```typescript
MAX_GUESTS_PER_IP = 3 (per 24 hours)
MAX_GUESTS_PER_DEVICE = 1 (per 7 days)
SYSTEM_RATE_LIMIT = 10 (per 5 minutes globally)
LOCK_TIMEOUT = 30 seconds
```

#### Token Management
- Access tokens: 1 hour expiration
- Refresh tokens: 7 days expiration
- Automatic refresh when < 5 minutes remaining
- Secure cookie attributes when HTTPS available

## Migration Notes

### Breaking Changes
- Guest accounts now use session-based authentication instead of stored passwords
- Extension messaging format updated with sanitized data
- Device binding now uses secure session tokens

### Backward Compatibility
- Legacy message format maintained for extension compatibility
- Existing device IDs preserved during migration
- Graceful fallback for environments without crypto.getRandomValues

## Security Best Practices Implemented

1. **Defense in Depth**: Multiple layers of rate limiting and validation
2. **Principle of Least Privilege**: Minimal data exposure in client storage
3. **Secure by Default**: Automatic token refresh and validation
4. **Input Validation**: Comprehensive sanitization and format checking
5. **Error Handling**: Secure error messages without information leakage

## Testing Recommendations

1. Test rate limiting with multiple IPs and devices
2. Verify token refresh functionality
3. Test race condition scenarios with multiple tabs
4. Validate XSS prevention with malicious inputs
5. Test extension messaging with various payloads
6. Verify secure context detection across environments

## Future Security Enhancements

1. Implement Content Security Policy (CSP) headers
2. Add request signing for API calls
3. Implement session fingerprinting for additional security
4. Consider implementing Web Authentication API for stronger authentication
5. Add comprehensive audit logging for security events

## Monitoring and Alerting

Consider implementing monitoring for:
- Unusual guest account creation patterns
- Failed rate limit attempts
- Token refresh failures
- Extension messaging errors
- XSS attempt detection
