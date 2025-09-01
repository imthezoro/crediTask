# Account Deletion, Email Blocking, and Reactivation Design

## Goals
- Robust, irreversible user-initiated deletion (hard delete) across app DB and Supabase auth.
- Temporarily block the deleted email to prevent immediate reuse/abuse.
- Clean re-signup after block expiry (treat as a new account), with no confusing edge cases.
- Minimal information leakage (generic errors, timing normalization).
- Operationally simple, observable, and testable.

## Scope
- User-initiated delete from UI → `/api/auth/delete-account`.
- Admin moderation (suspension) remains separate; it can continue using `blocked_emails` with longer durations.
- Signup and OAuth callback must respect `blocked_emails`.

## Data Model
- Table: `public.blocked_emails`
  - `email text primary key`
  - `blocked_until timestamptz not null`
  - `reason text default 'Account deletion'` (added by migration 015)
  - Optional: `created_at timestamptz default now()`

### Indexes
- `create index if not exists blocked_emails_active_idx on blocked_emails (email, blocked_until)`

### RLS
- Keep as server-only (only admin service/edge/service role writes). Clients never read this table directly.

## Flows

### 1) User-Initiated Hard Delete
1. API: `POST /api/auth/delete-account`
2. AuthN required (current user).
3. Service: `HardDeleteService.hardDeleteUser(userId, { reason, performedBy: 'user', ip, ua })`
   - Look up email from `auth.users`.
   - Delete user data in app tables (order respects FK): `prompt_sessions`, `payments`, `signups`, `audit_logs`, `user_profiles`.
   - Upsert into `blocked_emails (email, blocked_until, reason)` with default duration (e.g., 7 days).
   - Hard delete `auth.users` via `admin.auth.admin.deleteUser(userId, true)`.
   - Audit log the deletion.
4. Response: success + generic message.

Notes:
- If any per-table deletion fails, log and continue (best-effort cleanup) since the account is being removed.
- Email block must succeed; otherwise, fail the operation (to avoid immediate reuse).

### 2) Signup (Email/Password)
1. API: `POST /api/auth/signup`.
2. Validate input, normalize email to lowercase.
3. Check `blocked_emails` for `email` where `blocked_until > now()`.
   - If found: 403 with generic text: "This email is blocked due to a previous account deletion. Please try again later." (Optional: show days remaining if desired.)
4. Cleanup expired blocks for this email (delete where `blocked_until < now()`).
5. Proceed with `supabase.auth.signUp()`.
6. Log auth attempt (success/failure) with hashed email.

### 3) OAuth Callback
1. After token exchange, call `POST /api/auth/validate-session` with `userId`.
2. Service `SecureAuthUtils.validateUserProfile(userId)`
   - Normalize timing.
   - Load `user_profiles` (and optionally minimal checks).
   - Return `{ isValid: true }` only if profile exists and is not soft-deleted (if soft delete still exists for admin use-cases).
3. On invalid: sign out and show a generic error.

### 4) Reactivation after Block Expiry
- We do not “reactivate” old accounts. After block expiry, signup proceeds as a new account.
- Expired block rows may be lazily cleaned during signup (delete) and/or via scheduled cleanup job.

## Trigger vs. Scheduled Job

### Option A: Scheduled Cleanup (Recommended for simplicity)
- Daily job/edge function: delete rows in `blocked_emails` where `blocked_until < now()`.
- Pros: Simple, explicit; no surprises.
- Cons: Expired rows persist until the job runs (doesn’t affect correctness).

### Option B: Postgres Trigger
- Trigger on `blocked_emails` to auto-delete rows once expired.
- Pros: Automatic.
- Cons: More complexity; time-based triggers are typically implemented via jobs, not DML triggers.

Conclusion: Prefer scheduled cleanup. Also perform per-email cleanup during signup.

## API Contracts (Server)

### POST `/api/auth/delete-account`
- Auth required.
- Body: none.
- Response: `{ success: true, message: 'Account permanently deleted. Email blocked.' }` or `{ error }`.

### POST `/api/auth/signup`
- Body: `{ email: string, password: string }`.
- Responses:
  - 200: `{ success: true, message, data?: { id, email } }`
  - 403: `{ error: 'This email is blocked...' }`
  - 400/500: generic `{ error }` with timing normalization.

### POST `/api/auth/validate-session`
- Body: `{ userId: string }`
- Responses: `{ isValid: boolean, error?: string }` (generic error text)

## Services

### `HardDeleteService`
- `hardDeleteUser(userId, options)`
  - Delete app data
  - Upsert email block
  - Delete auth user
  - Audit log
- `isEmailBlocked(email)`
- `cleanupExpiredBlocks()`

### `SecureAuthUtils`
- `validateUserProfile(userId)` with constant-time and generic errors.
- `addRandomDelay(maxMs)`; `normalizeResponseTime(start)`
- `logAuthAttempt(email, success, ip, ua, userId?)` with hashed email.

## Client UX
- Delete flow: confirm irreversible deletion. After success: sign out and redirect to signin with a generic success message.
- Signup: call server endpoint; on block show friendly message (configurable), otherwise generic failure text. Never expose whether a specific email exists.
- OAuth callback: if validation fails, sign out + generic error.

## Security & Privacy
- Normalize timings. Generic errors for all auth flows.
- Emails normalized to lowercase for comparisons.
- RLS prevents client access to `blocked_emails`.
- Audit logging stores hashed emails only.

## Observability
- Audit logs for delete, signup success/failure.
- Structured server logs for block checks and hard deletes.

## Migration Plan
1. Deploy migration 015 (adds `reason` column to `blocked_emails`).
2. Deploy service + API changes.
3. Update UI to use new API endpoints.
4. Add daily cleanup job (optional but recommended).

## Deleting Unused Files
- Remove `app/api/account/deactivate/route.ts` (already deleted in staged changes).
- Consider removing `supabase/functions/soft-delete-user/` if no longer used by admin tools.

## Open Questions
1. What is the default block duration for user-initiated delete? (Current default: 7 days.)
2. Precise list/order of app tables to purge (we used: `prompt_sessions`, `payments`, `signups`, `audit_logs`, `user_profiles`). Any others?
3. Messaging: Do you want explicit remaining days in the signup error, or a generic message only?
4. Should admin suspensions use the same `blocked_emails` table but with a longer duration (e.g., 30 days)?
5. Do we need a data-retention window for specific tables (e.g., payments) instead of immediate purge?
6. Do we keep a tombstone audit of the email hash post-delete for compliance reporting?
