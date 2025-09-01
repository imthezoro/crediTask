# Account Reactivation and Re-creation Fix

## Problem Statement

When users try to recreate previously deleted/deactivated accounts:
- **Email/password signup**: Returns "user already registered" error
- **Google OAuth**: Redirects to signin page with "Invalid email or password" error

## Root Causes

1. **Supabase auth.users persistence**: Even soft-deleted accounts remain in `auth.users`, preventing duplicate email signup
2. **Block policy not handled in signup flow**: `blocked_emails` table exists but signup doesn't check it
3. **OAuth validation failures**: Missing or invalid profile lookups cause OAuth sessions to be rejected
4. **Schema mismatches**: Code referenced non-existent columns causing validation failures

## Solution Approach

### 1. Email/Password Signup Flow
**Policy**: Treat deactivated users as completely new users - allow them to "recreate" their account

**Implementation**:
- Check `blocked_emails` table before signup
- If user exists in `auth.users` but is deactivated:
  - If still blocked: Return clear error with block expiry date
  - If block expired or no block: Allow signup to proceed (Supabase will handle existing user)
- Clean up old `user_profiles` data and create fresh profile

### 2. OAuth Callback Flow  
**Policy**: Reactivate automatically if block period has expired

**Implementation**:
- In `validateUserProfile()`: Check `blocked_emails` regardless of profile existence
- If blocked and block expired:
  - Remove block record
  - Create/reactivate `user_profiles` with `is_active: true`
  - Allow OAuth to proceed
- If still blocked: Sign out and show clear error message

### 3. Keep It Simple
- No `reactivated_at` columns
- No complex reactivation workflows
- Minimal changes to existing security patterns

## Files to Modify

### 1. `app/api/auth/signup/route.ts`
- Add pre-signup validation for blocked emails
- Handle existing deactivated users as new signups
- Clean up old profile data before creating new

### 2. `lib/secure-auth-utils.ts`
- Enhance `validateUserProfile()` to handle expired blocks
- Add reactivation logic for OAuth flow
- Maintain constant-time responses and security

### 3. `app/auth/callback/page.tsx` (minimal changes)
- Better error handling for blocked accounts
- Show specific messages for different failure types

## Implementation Details

### Signup Flow Enhancement
```typescript
// In signup route - before calling Supabase signup
const blockCheck = await checkAndHandleBlockedEmail(email)
if (blockCheck.isBlocked) {
  return NextResponse.json(
    { error: `Account deactivated until ${blockCheck.blockedUntil}` },
    { status: 403 }
  )
}

// If user exists but was deactivated, clean up old data
if (blockCheck.wasDeactivated && !blockCheck.isBlocked) {
  await cleanupOldUserData(email)
}
```

### OAuth Reactivation Logic
```typescript
// In validateUserProfile - after checking blocked_emails
if (isBlocked) {
  const blockExpired = new Date(blockedEmail.blocked_until) <= new Date()
  if (blockExpired) {
    // Remove expired block and reactivate
    await admin.from('blocked_emails').delete().eq('email', userEmail)
    // Create/update profile as active
    await ensureActiveProfile(userId)
    isBlocked = false
  }
}
```

## Expected Behavior After Fix

### Email/Password Signup
- **New user**: Normal signup flow
- **Deactivated user (block expired)**: Signup succeeds, creates fresh account
- **Deactivated user (still blocked)**: Clear error: "Account deactivated until [date]"
- **Active user**: "Email already registered"

### Google OAuth
- **New user**: Profile auto-created, proceeds to dashboard
- **Deactivated user (block expired)**: Auto-reactivated, proceeds to dashboard  
- **Deactivated user (still blocked)**: Signed out, clear error message
- **Active user**: Normal OAuth flow to dashboard

## Security Considerations

- Maintain constant-time responses to prevent user enumeration
- Preserve existing rate limiting and security middleware
- Keep generic error messages as fallback for unexpected cases
- Audit log all reactivation events

## Testing Scenarios

1. **Email signup with expired deactivation**: Should succeed
2. **Email signup with active deactivation**: Should show clear error
3. **OAuth with expired deactivation**: Should auto-reactivate and proceed
4. **OAuth with active deactivation**: Should show clear error
5. **Normal flows**: Should remain unchanged

## Migration Requirements

None - uses existing `blocked_emails` and `user_profiles` tables from migrations 010 and 011.
