# Soft Delete Implementation Summary

## Overview
Implemented comprehensive soft deletion with email blocking strategy to prevent immediate re-signup after account deactivation.

## Components Implemented

### 1. Database Migrations
- **011.sql**: Created `blocked_emails` table with 24-hour blocking mechanism
- **012.sql**: Updated RLS policies to check `user_profiles.is_active` for all user operations

### 2. API Endpoints

#### `/api/account/deactivate` (POST)
- Soft-deactivates user profile (`is_active = false`, `deleted_at = now()`)
- Blocks email for 24 hours in `blocked_emails` table
- Attempts to revoke refresh tokens via admin API
- Returns `{ success: true }` on completion

#### `/api/auth/pre-signup` (POST)
- Checks if email is blocked before allowing signup
- Returns `{ blocked: true, blocked_until, message }` if blocked
- Returns `{ blocked: false }` if email is available

#### `/api/auth/validate-session` (POST)
- Validates current session and checks `user_profiles.is_active`
- Returns `{ valid: false, reason: 'deactivated', message }` for deactivated accounts
- Used by all auth flows for consistent validation

### 3. Frontend Updates

#### Signup Flow (`/app/auth/signup/page.tsx`)
- Calls `/api/auth/pre-signup` before attempting signup
- Shows clear error message if email is blocked with expiry time

#### Server Signup API (`/app/api/auth/signup/route.ts`)
- Double-checks blocked emails server-side before creating account
- Prevents bypass attempts

#### Login Flows
- **Email/Password**: Calls `/api/auth/validate-session` after successful auth
- **OAuth Callback**: Validates session in callback handler
- **Guest Login**: Already had deactivated account detection

### 4. Extension Sync
- Existing `AuthService.signOut()` triggers `notifyExtension('SIGNED_OUT')`
- Background service clears tokens and broadcasts `TOKEN_UPDATE(null)`
- All tabs receive logout notification and clear local auth state

## Security Features

### Email Blocking
- 24-hour block prevents immediate re-signup with same email
- Only service role can write to `blocked_emails` (RLS enforced)
- Automatic cleanup when block expires

### Token Revocation
- Admin API calls to invalidate refresh tokens
- Multiple fallback methods for token invalidation
- Immediate session cleanup on deactivation detection

### RLS Protection
- All user data tables check `user_profiles.is_active`
- Deactivated users cannot access any protected resources
- Policies updated for `prompt_sessions`, `payments`, etc.

### Validation Layers
- Client-side pre-signup check
- Server-side signup validation
- Post-auth session validation
- Continuous session monitoring via `validateAndRefreshToken()`

## User Experience

### Deactivation Messages
- **Login attempt**: "This account has been deactivated. Please create a new account to continue."
- **Signup attempt**: "This email was recently used for a deactivated account and can't be reused until [timestamp]"

### Flow Behavior
1. User deactivates account → immediate logout across all tabs/extension
2. User tries to login → blocked with clear message
3. User tries to signup with same email → blocked for 24 hours
4. After 24 hours → user can create new account with same email

## Testing Checklist

### Manual Tests
- [ ] Deactivate account via settings page
- [ ] Verify immediate logout in all browser tabs
- [ ] Verify extension clears token and shows logged out state
- [ ] Try to login with deactivated account (should fail)
- [ ] Try to signup with blocked email (should fail with timestamp)
- [ ] Wait 24 hours or manually clear `blocked_emails` entry
- [ ] Verify signup works with previously blocked email

### Database Verification
```sql
-- Check soft delete worked
SELECT id, email, is_active, deleted_at FROM user_profiles WHERE email = 'test@example.com';

-- Check email blocking
SELECT email, blocked_until FROM blocked_emails WHERE email = 'test@example.com';

-- Verify RLS policies
\d+ prompt_sessions  -- Should show policies checking is_active
```

### API Testing
```bash
# Test pre-signup endpoint
curl -X POST http://localhost:3000/api/auth/pre-signup \
  -H "Content-Type: application/json" \
  -d '{"email":"blocked@example.com"}'

# Test session validation
curl -X POST http://localhost:3000/api/auth/validate-session \
  -H "Cookie: sb-access-token=..." \
  -H "Content-Type: application/json"
```

## Architecture Benefits

### Immediate Enforcement
- Token revocation ensures quick session termination
- RLS policies block data access immediately
- Extension sync propagates logout to all contexts

### Temporary Email Block
- Prevents confusion from immediate re-signup attempts
- 24-hour window allows for account recovery consideration
- Automatic cleanup prevents permanent blocks

### Consistent Validation
- Single `/api/auth/validate-session` endpoint used everywhere
- Centralized deactivation logic
- Clear error messages across all flows

## Future Enhancements

### Monitoring
- Log deactivation events for analytics
- Track blocked signup attempts
- Alert on unusual deactivation patterns

### User Experience
- Account recovery flow within 24-hour window
- Email notification on account deactivation
- Grace period before full deactivation

### Security
- Rate limiting on deactivation attempts
- Admin dashboard for managing blocked emails
- Audit trail for all account status changes
