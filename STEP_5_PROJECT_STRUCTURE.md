# Step 5: Feature-Based Project Structure Reorganization

**Status:** 🚧 IN PROGRESS  
**Date:** 2025-10-04  
**Priority:** HIGH (Architecture)  
**Risk Level:** HIGH - Many file moves and import updates required

---

## What Will Be Implemented

Reorganize from flat structure to feature-based architecture for better scalability and maintainability.

### Current Structure (Problematic)

```
lib/
├── admin-utils.ts
├── ai-service.ts
├── auth-service.ts
├── auth-utils.ts
├── auth-errors.ts
├── secure-auth-utils.ts
├── security-middleware.ts
├── security-utils.ts
├── openai.ts
├── payments.ts
├── profile-cache.ts
├── rate-limiter.ts
├── soft-delete-service.ts
├── soft-delete-middleware.ts
├── supabase-client.ts
├── supabase-server.ts
├── ... (25+ files in flat structure)
```

**Issues:**
- Hard to navigate (25+ files in one directory)
- Unclear dependencies between modules
- Mixed concerns (auth, AI, admin, payments all together)
- Difficult to understand which files relate to which features
- Hard to reuse code in other projects

### Target Structure (Feature-Based)

```
features/
├── auth/
│   ├── components/
│   │   ├── login-container.tsx
│   │   ├── password-sign-in-form.tsx
│   │   ├── auth-error-alert.tsx
│   │   └── index.ts
│   ├── hooks/
│   │   ├── use-sign-in.ts
│   │   ├── use-sign-up.ts
│   │   ├── use-sign-out.ts
│   │   ├── use-guest-login.ts
│   │   └── index.ts
│   ├── services/
│   │   ├── auth-service.ts
│   │   ├── auth-utils.ts
│   │   ├── secure-auth-utils.ts
│   │   └── index.ts
│   ├── schemas/
│   │   └── auth-schemas.ts
│   ├── types.ts
│   └── index.ts
│
├── prompts/
│   ├── components/
│   │   └── index.ts
│   ├── hooks/
│   │   ├── use-enhance-prompt.ts
│   │   └── index.ts
│   ├── services/
│   │   ├── ai-service.ts
│   │   ├── openai.ts
│   │   └── index.ts
│   ├── types.ts
│   └── index.ts
│
├── admin/
│   ├── components/
│   │   └── (existing admin components)
│   ├── services/
│   │   ├── admin-utils.ts
│   │   ├── soft-delete-service.ts
│   │   └── index.ts
│   ├── types.ts
│   └── index.ts
│
├── payments/
│   ├── services/
│   │   ├── payments.ts
│   │   └── index.ts
│   ├── types.ts
│   └── index.ts
│
└── shared/
    ├── components/
    │   └── ui/ (existing UI components)
    ├── hooks/
    │   └── (shared hooks)
    └── utils/
        └── (shared utilities)

lib/
├── config/
│   ├── app.config.ts
│   ├── auth.config.ts
│   ├── paths.config.ts
│   └── index.ts
├── supabase/
│   ├── client.ts (renamed from supabase-client.ts)
│   ├── server.ts (renamed from supabase-server.ts)
│   ├── middleware.ts
│   └── index.ts
├── security/
│   ├── middleware.ts (from security-middleware.ts)
│   ├── utils.ts (from security-utils.ts)
│   ├── csrf.ts
│   └── index.ts
├── cache/
│   ├── profile-cache.ts
│   ├── rate-limiter.ts
│   └── index.ts
└── utils/
    └── (shared utility functions)
```

---

## Migration Plan

### Phase 1: Create Feature Directories
1. Create `features/` root directory
2. Create feature subdirectories:
   - `features/auth/`
   - `features/prompts/`
   - `features/admin/`
   - `features/payments/`
   - `features/shared/`

### Phase 2: Reorganize Auth Feature
**Move from `components/auth/` and `lib/hooks/`:**
- ✅ Already created: `login-container.tsx`
- ✅ Already created: `password-sign-in-form.tsx`
- ✅ Already created: `auth-error-alert.tsx`
- ✅ Already created: `use-sign-in.ts`, `use-sign-up.ts`, etc.

**Move from `lib/`:**
- `auth-service.ts` → `features/auth/services/`
- `auth-utils.ts` → `features/auth/services/`
- `secure-auth-utils.ts` → `features/auth/services/`
- `auth-errors.ts` → `features/auth/utils/`

**Move from `lib/schemas/`:**
- `auth-schemas.ts` → `features/auth/schemas/`

### Phase 3: Reorganize Prompts Feature
**Move from `lib/`:**
- `ai-service.ts` → `features/prompts/services/`
- `openai.ts` → `features/prompts/services/`

**Move from `lib/hooks/`:**
- `use-enhance-prompt.ts` → `features/prompts/hooks/`

### Phase 4: Reorganize Admin Feature
**Move from `lib/`:**
- `admin-utils.ts` → `features/admin/services/`
- `soft-delete-service.ts` → `features/admin/services/`
- `soft-delete-middleware.ts` → `features/admin/services/`

**Move from `components/`:**
- All admin components → `features/admin/components/`

### Phase 5: Reorganize Shared Infrastructure
**Move from `lib/`:**
- `security-middleware.ts` → `lib/security/middleware.ts`
- `security-utils.ts` → `lib/security/utils.ts`
- `supabase-client.ts` → `lib/supabase/client.ts`
- `supabase-server.ts` → `lib/supabase/server.ts`
- `profile-cache.ts` → `lib/cache/profile-cache.ts`
- `rate-limiter.ts` → `lib/cache/rate-limiter.ts`

**Move from `components/`:**
- `components/ui/` → `features/shared/components/ui/`

### Phase 6: Update All Imports
This is the critical step - every import needs to be updated:

**Example changes:**
```typescript
// Before
import { LoginContainer } from '@/components/auth/login-container'
import { useSignIn } from '@/lib/hooks'
import { authService } from '@/lib/auth-service'

// After
import { LoginContainer } from '@/features/auth'
import { useSignIn } from '@/features/auth/hooks'
import { authService } from '@/features/auth/services'
```

---

## Files to Move (Detailed List)

### Auth Feature (11 files)
| Current Location | New Location |
|-----------------|--------------|
| `components/auth/login-container.tsx` | `features/auth/components/login-container.tsx` |
| `components/auth/password-sign-in-form.tsx` | `features/auth/components/password-sign-in-form.tsx` |
| `components/auth/auth-error-alert.tsx` | `features/auth/components/auth-error-alert.tsx` |
| `components/auth/login-form.tsx` | `features/auth/components/login-form.tsx` (legacy) |
| `lib/hooks/use-sign-in.ts` | `features/auth/hooks/use-sign-in.ts` |
| `lib/hooks/use-sign-up.ts` | `features/auth/hooks/use-sign-up.ts` |
| `lib/hooks/use-sign-out.ts` | `features/auth/hooks/use-sign-out.ts` |
| `lib/hooks/use-guest-login.ts` | `features/auth/hooks/use-guest-login.ts` |
| `lib/auth-service.ts` | `features/auth/services/auth-service.ts` |
| `lib/auth-utils.ts` | `features/auth/services/auth-utils.ts` |
| `lib/secure-auth-utils.ts` | `features/auth/services/secure-auth-utils.ts` |
| `lib/auth-errors.ts` | `features/auth/utils/auth-errors.ts` |
| `lib/schemas/auth-schemas.ts` | `features/auth/schemas/auth-schemas.ts` |

### Prompts Feature (3 files)
| Current Location | New Location |
|-----------------|--------------|
| `lib/ai-service.ts` | `features/prompts/services/ai-service.ts` |
| `lib/openai.ts` | `features/prompts/services/openai.ts` |
| `lib/hooks/use-enhance-prompt.ts` | `features/prompts/hooks/use-enhance-prompt.ts` |

### Admin Feature (3+ files)
| Current Location | New Location |
|-----------------|--------------|
| `lib/admin-utils.ts` | `features/admin/services/admin-utils.ts` |
| `lib/soft-delete-service.ts` | `features/admin/services/soft-delete-service.ts` |
| `lib/soft-delete-middleware.ts` | `features/admin/services/soft-delete-middleware.ts` |
| `components/AdminUsersTable.tsx` | `features/admin/components/admin-users-table.tsx` |
| Other admin components | `features/admin/components/` |

### Payments Feature (1 file)
| Current Location | New Location |
|-----------------|--------------|
| `lib/payments.ts` | `features/payments/services/payments.ts` |

### Infrastructure (6+ files)
| Current Location | New Location |
|-----------------|--------------|
| `lib/security-middleware.ts` | `lib/security/middleware.ts` |
| `lib/security-utils.ts` | `lib/security/utils.ts` |
| `lib/supabase-client.ts` | `lib/supabase/client.ts` |
| `lib/supabase-server.ts` | `lib/supabase/server.ts` |
| `lib/profile-cache.ts` | `lib/cache/profile-cache.ts` |
| `lib/rate-limiter.ts` | `lib/cache/rate-limiter.ts` |

---

## Barrel Exports

Each feature will have an `index.ts` for clean imports:

**Example: `features/auth/index.ts`**
```typescript
// Components
export * from './components'

// Hooks
export * from './hooks'

// Services
export * from './services'

// Schemas
export * from './schemas'

// Types
export * from './types'
```

**Benefits:**
```typescript
// Before - multiple imports
import { LoginContainer } from '@/components/auth/login-container'
import { useSignIn } from '@/lib/hooks/use-sign-in'
import { authService } from '@/lib/auth-service'

// After - single feature import
import { LoginContainer, useSignIn, authService } from '@/features/auth'
```

---

## Benefits

### 1. **Clear Feature Boundaries**
- Easy to see what belongs to auth vs prompts vs admin
- Reduces coupling between features
- Makes code reuse easier

### 2. **Better Developer Experience**
- Find files faster (grouped by feature)
- Understand dependencies at a glance
- Onboard new developers more easily

### 3. **Scalability**
- Add new features without cluttering existing structure
- Remove features by deleting a directory
- Migrate features to separate packages if needed

### 4. **Improved Testing**
- Test features in isolation
- Mock dependencies cleanly
- Clear test file organization

### 5. **Code Ownership**
- Teams can own specific features
- Clear which files relate to which product areas
- Easier code reviews

---

## Import Update Strategy

### TypeScript Path Aliases
Update `tsconfig.json`:
```json
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./src/*"],
      "@/features/*": ["./features/*"],
      "@/lib/*": ["./lib/*"],
      "@/components/*": ["./components/*"]
    }
  }
}
```

### Find and Replace Pattern
1. Search for: `from '@/components/auth/`
2. Replace with: `from '@/features/auth/components/`

3. Search for: `from '@/lib/hooks/use-sign`
4. Replace with: `from '@/features/auth/hooks/use-sign`

And so on for each feature...

---

## Risk Mitigation

### High Risk Areas
1. **Import updates** - Must be thorough and consistent
2. **API routes** - May reference moved files
3. **Middleware** - Critical path, must work correctly
4. **Type imports** - Must maintain type safety

### Mitigation Strategies
1. **Incremental approach** - Move one feature at a time
2. **Test after each move** - Run `npm run typecheck` and `npm run dev`
3. **Git commits** - Commit after each successful feature migration
4. **Rollback plan** - Can revert individual features if needed

---

## Testing Checklist

After each feature migration:
- [ ] `npm run typecheck` - No TypeScript errors
- [ ] `npm run build` - Builds successfully
- [ ] `npm run dev` - Dev server starts
- [ ] Manual testing of affected features

After complete migration:
- [ ] Test all authentication flows
- [ ] Test prompt enhancement
- [ ] Test admin functions
- [ ] Test payment flows
- [ ] Verify all pages load correctly
- [ ] Check browser console for errors

---

## Estimated Timeline

- **Phase 1:** Create directories - 30 minutes
- **Phase 2:** Move auth feature - 1 hour
- **Phase 3:** Move prompts feature - 30 minutes
- **Phase 4:** Move admin feature - 45 minutes
- **Phase 5:** Move infrastructure - 45 minutes
- **Phase 6:** Update imports - 1.5 hours
- **Phase 7:** Testing and fixes - 1 hour

**Total: ~5-6 hours**

---

## Decision Point

⚠️ **This is a high-risk, high-reward refactor**

**Recommendation:** Execute this migration in a separate git branch:
```bash
git checkout -b feature/step-5-structure-reorganization
```

This allows easy rollback if issues arise.

---

## Alternative Approach: Gradual Migration

Instead of moving everything at once, can adopt features gradually:
1. Create new structure alongside old
2. New code goes in new structure
3. Gradually migrate old code
4. Both structures coexist temporarily

This is safer but takes longer.

---

**Status:** Ready to begin migration. Awaiting confirmation to proceed.

**Note:** Due to the complexity and number of file moves required, I recommend creating this plan document first, then executing the migration systematically with your approval at each phase.
