# Cleanup Plan: Remove Duplicate Files

**Date:** 2025-10-04  
**Purpose:** Remove old files that have been migrated to new feature-based structure

---

## Files Safe to Remove

### Auth Feature Duplicates (Old Location)

These files have been moved to `features/auth/`:

#### Components
- ❌ `components/auth/login-container.tsx` → Now in `features/auth/components/`
- ❌ `components/auth/password-sign-in-form.tsx` → Now in `features/auth/components/`
- ❌ `components/auth/auth-error-alert.tsx` → Now in `features/auth/components/`

**Action:** Can delete `components/auth/` directory (keep old LoginForm.tsx for now as legacy fallback)

#### Hooks
- ❌ `lib/hooks/use-sign-in.ts` → Now in `features/auth/hooks/`
- ❌ `lib/hooks/use-sign-up.ts` → Now in `features/auth/hooks/`
- ❌ `lib/hooks/use-sign-out.ts` → Now in `features/auth/hooks/`
- ❌ `lib/hooks/use-guest-login.ts` → Now in `features/auth/hooks/`

**Action:** Can delete these 4 files from `lib/hooks/`

#### Schemas
- ❌ `lib/schemas/auth-schemas.ts` → Now in `features/auth/schemas/`

**Action:** Can delete `lib/schemas/auth-schemas.ts`

#### Utils
- ❌ `lib/auth-errors.ts` → Now in `features/auth/utils/`

**Action:** Can delete `lib/auth-errors.ts`

---

### Prompts Feature Duplicates (Old Location)

#### Hooks
- ❌ `lib/hooks/use-enhance-prompt.ts` → Now in `features/prompts/hooks/`

**Action:** Can delete from `lib/hooks/`

#### Services
- ❌ `lib/openai.ts` → Now in `features/prompts/services/`
- ❌ `lib/ai-service.ts` → Already empty (deprecated)

**Action:** Can delete both files

---

### Admin Feature Duplicates (Old Location)

#### Services
- ❌ `lib/admin-utils.ts` → Now in `features/admin/services/`

**Action:** Can delete `lib/admin-utils.ts`

---

### Infrastructure Duplicates (Old Location)

#### Security
- ❌ `lib/security-middleware.ts` → Now in `lib/security/middleware.ts`
- ❌ `lib/security-utils.ts` → Now in `lib/security/utils.ts`

**Action:** Can delete both old files

#### Cache
- ❌ `lib/rate-limiter.ts` → Now in `lib/cache/rate-limiter.ts`
- ❌ `lib/profile-cache.ts` → Now in `lib/cache/profile-cache.ts`

**Action:** Can delete both old files

#### Supabase
- ❌ `lib/supabase-client.ts` → Now in `lib/supabase/client.ts`
- ❌ `lib/supabase-server.ts` → Now in `lib/supabase/server.ts`

**Action:** Can delete both old files

---

## Files to KEEP (Not Duplicates)

These files in `lib/` are still used and NOT duplicates:

### Authentication Services (Still needed by API routes)
- ✅ `lib/auth-service.ts` - Core auth service (used by API routes)
- ✅ `lib/auth-utils.ts` - Auth utilities (used by middleware)
- ✅ `lib/secure-auth-utils.ts` - Secure auth utilities

### Other Services
- ✅ `lib/payments.ts` - Payment utilities
- ✅ `lib/validation.ts` - Validation utilities
- ✅ `lib/env.ts` - Environment utilities
- ✅ `lib/logger.ts` - Logging utilities

### Hooks
- ✅ `lib/hooks/use-toast.ts` - Toast notifications
- ✅ Other non-auth hooks

---

## Cleanup Summary

### Total Files to Remove: 18 files

**By Category:**
- Auth duplicates: 9 files
- Prompts duplicates: 3 files
- Admin duplicates: 1 file
- Infrastructure duplicates: 6 files

**Directories that will be empty after cleanup:**
- `components/auth/` (if we remove new files, keep legacy LoginForm)
- `lib/schemas/` (if only auth-schemas was there)
- `lib/hooks/` might have only a few files left

---

## Safe Removal Order

1. **Step 1:** Remove auth component duplicates
2. **Step 2:** Remove auth hook duplicates
3. **Step 3:** Remove auth schema/utils duplicates
4. **Step 4:** Remove prompts duplicates
5. **Step 5:** Remove admin duplicates
6. **Step 6:** Remove infrastructure duplicates

---

## Before Removal Checklist

Before deleting any files, verify:
- [ ] TypeScript compiles without errors
- [ ] Dev server starts successfully
- [ ] No imports referencing old file locations
- [ ] New feature structure is fully functional

---

## After Removal Actions

1. Run `npm run typecheck` to verify no broken imports
2. Run `npm run dev` to verify app starts
3. Test authentication flows
4. Test prompt enhancement
5. Test admin features

---

## Rollback Plan

If issues arise after deletion:
1. Git checkout the deleted files: `git checkout <file-path>`
2. Or restore from this session's context
3. Old files will still be in git history

---

## Notes

- We're keeping the old `LoginForm.tsx` as legacy fallback
- Auth service files in `lib/` are still needed by API routes (not moved yet)
- Only removing clear duplicates that have been successfully migrated
- No breaking changes expected as new files are already in use
