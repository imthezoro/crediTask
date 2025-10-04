# Step 4: Type-Safe Configuration with Zod

**Status:** ✅ COMPLETED  
**Date:** 2025-10-04  
**Priority:** HIGH (Security & Reliability)

---

## What Was Implemented

Replaced direct `process.env` usage with validated, type-safe configuration using Zod schemas.

### Problem Addressed

**Before:** 
- Environment variables accessed directly throughout codebase
- No validation - errors discovered at runtime in production
- No type safety - typos not caught by TypeScript
- Inconsistent usage patterns
- Hard to track which env vars are required

**After:** 
- Centralized configuration with Zod validation
- Build-time validation catches errors before deployment
- Full TypeScript autocomplete and type checking
- Consistent patterns across entire app
- Self-documenting configuration

---

## Files Created

### 1. **Application Configuration**
**File:** `lib/config/app.config.ts`

Validates core application settings:
```typescript
const AppConfigSchema = z.object({
  name: z.string().min(1),
  url: z.string().url(),
  production: z.boolean(),
  supabase: z.object({
    url: z.string().url(),
    anonKey: z.string().min(1),
  }),
  openai: z.object({
    apiKey: z.string().min(1),
  }),
  stripe: z.object({
    publishableKey: z.string().optional(),
    secretKey: z.string().optional(),
    webhookSecret: z.string().optional(),
  }),
  redis: z.object({
    url: z.string().optional(),
    token: z.string().optional(),
  }),
}).refine(
  (schema) => schema.production ? schema.url.startsWith('https://') : true,
  { message: 'Production URL must use HTTPS' }
)

export const appConfig = AppConfigSchema.parse({
  name: process.env.NEXT_PUBLIC_PRODUCT_NAME || 'PromptOK',
  url: process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000',
  // ... validates at build time!
})
```

**Key Features:**
- ✅ Required fields throw errors if missing
- ✅ URL validation for endpoints
- ✅ Production-specific rules (HTTPS enforcement)
- ✅ Optional fields for gradual adoption
- ✅ Type inference for autocomplete

### 2. **Authentication Configuration**
**File:** `lib/config/auth.config.ts`

Centralizes auth-related settings:
```typescript
export const authConfig = {
  providers: {
    password: true,
    google: true,
    magicLink: false,
  },
  session: {
    cookieName: 'promptok-session',
    maxAge: 7 * 24 * 60 * 60, // 7 days
  },
  callbacks: {
    signIn: '/tools/enhance',
    signOut: '/auth/signin',
    error: '/auth/signin',
  },
}
```

**Benefits:**
- Single source of truth for auth config
- Easy to toggle providers
- Consistent redirect URLs

### 3. **Paths Configuration**
**File:** `lib/config/paths.config.ts`

Type-safe route definitions:
```typescript
export const pathsConfig = {
  auth: {
    signIn: '/auth/signin',
    signUp: '/auth/signup',
    callback: '/auth/callback',
  },
  app: {
    home: '/',
    dashboard: '/dashboard',
    enhance: '/tools/enhance',
  },
  api: {
    auth: {
      login: '/api/auth/login',
      signup: '/api/auth/signup',
      guestLogin: '/api/auth/guest-login',
    },
    enhance: '/api/enhance',
  },
} as const
```

**Benefits:**
- No hardcoded URLs in components
- Autocomplete for all paths
- Easy to refactor routes
- Type errors on typos

### 4. **Barrel Export**
**File:** `lib/config/index.ts`

Clean centralized imports:
```typescript
export { appConfig, type AppConfig } from './app.config'
export { authConfig, type AuthConfig } from './auth.config'
export { pathsConfig, type AppPaths } from './paths.config'
```

### 5. **Environment Template**
**File:** `.env.example`

Documents all required environment variables:
```bash
# Application Configuration
NEXT_PUBLIC_PRODUCT_NAME=PromptOK
NEXT_PUBLIC_SITE_URL=http://localhost:3000

# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
...
```

---

## Files Modified

### 1. **middleware.ts**
**Replaced:**
```typescript
process.env.NODE_ENV === 'production'
process.env.NEXT_PUBLIC_SUPABASE_URL!
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
```

**With:**
```typescript
import { appConfig } from './lib/config'

appConfig.production
appConfig.supabase.url
appConfig.supabase.anonKey
```

### 2. **All Auth Hooks**
Updated 4 hooks to use `pathsConfig` and `authConfig`:
- ✅ `use-sign-in.ts` - API paths and redirect URLs
- ✅ `use-sign-up.ts` - API paths and redirect URLs
- ✅ `use-sign-out.ts` - Redirect URLs
- ✅ `use-guest-login.ts` - API paths and redirect URLs

### 3. **LoginContainer**
**Replaced:**
```typescript
`${process.env.NEXT_PUBLIC_SITE_URL || window.location.origin}/auth/callback`
'/auth/signup'
```

**With:**
```typescript
`${appConfig.url}${pathsConfig.auth.callback}`
pathsConfig.auth.signUp
```

---

## Usage Examples

### Before (Direct env access)
```typescript
// Scattered throughout codebase
const supabase = createServerClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// No type checking
router.push('/tools/enhance') // Typo not caught

// No validation
const apiUrl = process.env.API_URL // Could be undefined
```

### After (Type-safe config)
```typescript
// Centralized, validated
import { appConfig, pathsConfig } from '@/lib/config'

const supabase = createServerClient(
  appConfig.supabase.url,
  appConfig.supabase.anonKey
)

// Type-safe with autocomplete
router.push(authConfig.callbacks.signIn) // ✅ Autocomplete works

// Validated at build time
console.log(appConfig.url) // ✅ Guaranteed to exist
```

---

## Benefits

### 1. **Build-Time Validation**
```bash
# Missing env var example
❌ Error: Invalid configuration
  Field: supabase.url
  Message: Required

# Invalid URL example  
❌ Error: Invalid configuration
  Field: url
  Message: Valid URL is required
```

Catches errors before deployment, not in production!

### 2. **Type Safety & Autocomplete**
```typescript
// IDE autocomplete for all paths
pathsConfig.auth.signIn     // ✅ '/auth/signin'
pathsConfig.app.enhance     // ✅ '/tools/enhance'
pathsConfig.api.auth.login  // ✅ '/api/auth/login'

// Type error on typos
pathsConfig.auth.signnn     // ❌ TypeScript error
```

### 3. **Refactoring Safety**
Change path once, updates everywhere:
```typescript
// Update in one place
export const pathsConfig = {
  auth: {
    signIn: '/login', // Changed from '/auth/signin'
  }
}

// All usages automatically updated
// No find-replace needed
// No missed hardcoded strings
```

### 4. **Self-Documenting**
Configuration serves as documentation:
```typescript
// Clear what providers are enabled
authConfig.providers.google    // true
authConfig.providers.magicLink // false

// Clear where users go after login
authConfig.callbacks.signIn    // '/tools/enhance'
```

### 5. **Environment-Specific Rules**
```typescript
// Production-specific validation
AppConfigSchema.refine(
  (schema) => schema.production ? schema.url.startsWith('https://') : true,
  { message: 'Production URL must use HTTPS' }
)
```

---

## Migration Pattern

### Step 1: Import Config
```typescript
import { appConfig, pathsConfig, authConfig } from '@/lib/config'
```

### Step 2: Replace Direct Usage
```typescript
// Before
const url = process.env.NEXT_PUBLIC_SITE_URL
router.push('/auth/signin')

// After
const url = appConfig.url
router.push(pathsConfig.auth.signIn)
```

### Step 3: Enjoy Type Safety
TypeScript will now catch typos and missing values!

---

## Testing Instructions

### 1. Verify Build-Time Validation
```bash
# Remove required env var from .env.local
# Then try to build
npm run build

# Should fail with clear error message:
# ❌ Error: Invalid configuration
#   Field: supabase.url
#   Message: Required
```

### 2. Test Type Safety
```typescript
// In any file, try:
import { pathsConfig } from '@/lib/config'

pathsConfig.auth.      // ✅ Should show autocomplete
pathsConfig.auth.signnn // ❌ Should show TypeScript error
```

### 3. Test Runtime
```bash
npm run dev
```

Navigate to:
- ✅ http://localhost:3000/auth/signin
- ✅ Test login → Should redirect to `/tools/enhance`
- ✅ Test all navigation links

All functionality should work identically, but now with type safety!

---

## Configuration Coverage

### Currently Using Type-Safe Config
✅ Middleware (CSRF, Supabase)  
✅ Auth hooks (all 4 hooks)  
✅ LoginContainer  
✅ OAuth redirects  
✅ API paths  

### Can Be Migrated (Future)
⏳ API routes (still using `process.env`)  
⏳ Supabase client initialization  
⏳ OpenAI service  
⏳ Stripe integration  
⏳ Other components with hardcoded paths  

---

## Reference Implementation

Based on: `nextjs-saas-starter-kit-lite/packages/configuration/`

**Patterns adopted:**
- ✅ Zod for validation
- ✅ Build-time parsing
- ✅ Type inference
- ✅ Environment-specific rules
- ✅ Centralized configuration

**Adapted for PromptOK:**
- Added OpenAI configuration
- Added guest auth settings
- Preserved extension-related config
- Added comprehensive path mappings

---

## Security Improvements

### 1. **Production HTTPS Enforcement**
```typescript
.refine(
  (schema) => schema.production ? schema.url.startsWith('https://') : true,
  { message: 'Production URL must use HTTPS' }
)
```

### 2. **Required Fields Validation**
Can't deploy without critical env vars:
- Supabase URL & keys
- OpenAI API key
- Application URL

### 3. **Type-Safe Secrets**
No risk of typos in env var names:
```typescript
// Before - risky
const key = process.env.OPENAI_API_KEYYY // Typo not caught

// After - safe
const key = appConfig.openai.apiKey // TypeScript catches errors
```

---

## File Summary

### Created (5 files)
1. ✅ `lib/config/app.config.ts` - Application settings
2. ✅ `lib/config/auth.config.ts` - Auth settings
3. ✅ `lib/config/paths.config.ts` - Route paths
4. ✅ `lib/config/index.ts` - Barrel exports
5. ✅ `.env.example` - Environment template

### Modified (7 files)
1. ✅ `middleware.ts` - Use appConfig
2. ✅ `lib/hooks/use-sign-in.ts` - Use pathsConfig & authConfig
3. ✅ `lib/hooks/use-sign-up.ts` - Use pathsConfig & authConfig
4. ✅ `lib/hooks/use-sign-out.ts` - Use authConfig
5. ✅ `lib/hooks/use-guest-login.ts` - Use pathsConfig & authConfig
6. ✅ `components/auth/login-container.tsx` - Use appConfig & pathsConfig
7. ✅ `components/auth/password-sign-in-form.tsx` - Use pathsConfig

---

## Rollback Instructions

If issues arise, can gradually revert:

**Option 1: Revert specific file**
```typescript
// Change back to:
const url = process.env.NEXT_PUBLIC_SITE_URL
```

**Option 2: Keep config but make optional**
```typescript
// Make fields optional during transition
z.string().optional()
```

**Option 3: Full rollback**
Delete `lib/config/` directory and revert modified files.

---

## Next Steps

This completes **Step 4: Type-Safe Configuration**.

**Gradual Migration Recommended:**
Can now progressively update remaining files:
1. API routes
2. Supabase client files
3. Service files (OpenAI, Stripe)
4. Remaining components

**Ready for:** Step 5 - Reorganize project structure (feature-based)

---

## Additional Notes

- No runtime performance impact (validated at build time)
- Compatible with all existing code
- Can adopt gradually (old pattern still works)
- Zod already installed (used in Step 3)
- `.env.example` helps onboard new developers

**Key Benefit:** Configuration errors caught at build time, not in production! 🎉
