# PromptOK Codebase Improvement Plan

**Based on Analysis of:** nextjs-saas-starter-kit-lite (Professional SaaS Starter Kit)  
**Date:** 2025-10-04  
**Status:** Planning Phase

---

## Executive Summary

This document outlines a comprehensive plan to refactor PromptOK's codebase based on industry best practices observed in the nextjs-saas-starter-kit-lite reference implementation. The improvements focus on architecture, security, maintainability, and developer experience.

**Current State:**
- Flat project structure with mixed concerns
- Manual state management and API calls
- No CSRF protection
- 268-line authentication component with embedded logic
- 25+ utility files in flat `/lib` folder
- Basic database security

**Target State:**
- Feature-based modular architecture
- React Query for state management
- CSRF protection on all forms
- Container/Presentation component pattern
- Type-safe configuration
- Enhanced database security
- Reusable UI component system

---

## Implementation Steps

### **STEP 1: Add CSRF Protection** 🔒 (HIGH PRIORITY)

**Why:** Currently vulnerable to Cross-Site Request Forgery attacks

**Current Gap:**
- No CSRF token validation on form submissions
- API routes accept requests without origin verification beyond custom middleware

**Reference Implementation:**
```tsx
// middleware.ts
import { createCsrfProtect } from '@edge-csrf/nextjs';

const csrfProtect = createCsrfProtect({
  cookie: { secure: appConfig.production },
  ignoreMethods: isServerAction(request) ? ['POST'] : ['GET', 'HEAD', 'OPTIONS'],
});
```

**Implementation Tasks:**
1. Install `@edge-csrf/nextjs` package
2. Update `middleware.ts` to include CSRF protection
3. Configure CSRF for form submissions and API routes
4. Test with existing authentication flows
5. Add proper error handling for CSRF failures

**Files to Modify:**
- `middleware.ts` - Add CSRF middleware
- `package.json` - Add dependency
- Test all form submissions (login, signup, settings)

**Estimated Time:** 1-2 hours  
**Risk:** Low (backward compatible)

---

### **STEP 2: Implement React Query** ⚡ (HIGH PRIORITY)

**Why:** Replace manual state management with industry-standard data fetching

**Current Issues:**
- Manual `useState` for loading/error states
- No request caching or deduplication
- No automatic retries
- Difficult to test
- Repeated boilerplate code

**Reference Implementation:**
```tsx
// Custom hook with React Query
export function useSignInWithEmailPassword() {
  const client = useSupabase();
  
  const mutationFn = async (credentials) => {
    const response = await client.auth.signInWithPassword(credentials);
    if (response.error) throw response.error.message;
    return response.data;
  };
  
  return useMutation({ mutationKey: ['auth', 'sign-in'], mutationFn });
}
```

**Implementation Tasks:**
1. Install `@tanstack/react-query`
2. Create `components/providers/query-provider.tsx`
3. Wrap app with QueryClientProvider in `app/layout.tsx`
4. Create auth hooks: `useSignIn`, `useSignUp`, `useSignOut`
5. Create prompt hooks: `useEnhancePrompt`, `usePromptHistory`
6. Update components to use new hooks

**Files to Create:**
- `components/providers/query-provider.tsx`
- `lib/hooks/use-sign-in.ts`
- `lib/hooks/use-sign-up.ts`
- `lib/hooks/use-sign-out.ts`
- `lib/hooks/use-enhance-prompt.ts`

**Files to Modify:**
- `app/layout.tsx` - Add QueryClientProvider
- `components/auth/login-form.tsx` - Use hooks instead of fetch
- `package.json` - Add dependency

**Estimated Time:** 2-3 hours  
**Risk:** Medium (requires refactoring existing code)

---

### **STEP 3: Refactor Authentication Components** 🎨 (HIGH PRIORITY)

**Why:** Current LoginForm has 268 lines with mixed concerns

**Current Issues:**
- Business logic mixed with UI
- Hard to test
- Hard to reuse
- Multiple responsibilities in one component

**Reference Pattern:**
```tsx
// Container (logic)
export function PasswordSignInContainer({ onSignIn }) {
  const signInMutation = useSignInWithEmailPassword();
  
  const onSubmit = useCallback(async (credentials) => {
    const data = await signInMutation.mutateAsync(credentials);
    if (onSignIn) onSignIn(data?.user?.id);
  }, [signInMutation, onSignIn]);
  
  return (
    <>
      <AuthErrorAlert error={signInMutation.error} />
      <PasswordSignInForm onSubmit={onSubmit} loading={signInMutation.isPending} />
    </>
  );
}

// Presentation (UI)
export function PasswordSignInForm({ onSubmit, loading }) {
  const form = useForm({
    resolver: zodResolver(PasswordSignInSchema),
  });
  
  return <Form {...form}>{/* Pure UI */}</Form>;
}
```

**Implementation Tasks:**
1. Install `react-hook-form` and `@hookform/resolvers`
2. Create auth schemas with Zod: `loginSchema`, `signupSchema`
3. Split LoginForm into:
   - `login-form.tsx` (presentation - UI only)
   - `login-container.tsx` (container - logic)
   - `auth-error-alert.tsx` (error display)
4. Repeat for SignupForm
5. Update pages to use containers

**Files to Create:**
- `components/auth/login-container.tsx`
- `components/auth/signup-container.tsx`
- `components/auth/auth-error-alert.tsx`
- `lib/schemas/auth-schemas.ts`

**Files to Modify:**
- `components/auth/login-form.tsx` - Refactor to pure UI
- `components/auth/signup-form.tsx` - Refactor to pure UI
- `app/auth/signin/page.tsx` - Use container
- `app/auth/signup/page.tsx` - Use container
- `package.json` - Add dependencies

**Estimated Time:** 3-4 hours  
**Risk:** Medium (requires careful refactoring)

---

### **STEP 4: Add Type-Safe Configuration** ✅ (HIGH PRIORITY)

**Why:** Catch configuration errors at build time, not runtime

**Current Issues:**
- Environment variables accessed directly
- No validation
- Errors discovered in production
- No type safety

**Reference Implementation:**
```tsx
// config/app.config.ts
const AppConfigSchema = z.object({
  name: z.string().min(1),
  url: z.string().url(),
  supabase: z.object({
    url: z.string().url(),
    anonKey: z.string(),
  }),
}).refine(
  (schema) => schema.production ? !schema.url.startsWith('http:') : true,
  { message: 'Production must use HTTPS' }
);

export const appConfig = AppConfigSchema.parse({
  name: process.env.NEXT_PUBLIC_PRODUCT_NAME,
  url: process.env.NEXT_PUBLIC_SITE_URL,
  // Validates at build time!
});
```

**Implementation Tasks:**
1. Create `lib/config/` directory
2. Create `app.config.ts` with Zod validation
3. Create `auth.config.ts` for auth settings
4. Create `paths.config.ts` for route paths
5. Replace all `process.env.*` calls with config imports
6. Add `.env.example` file with all required variables

**Files to Create:**
- `lib/config/app.config.ts`
- `lib/config/auth.config.ts`
- `lib/config/paths.config.ts`
- `.env.example`

**Files to Modify:**
- All files using `process.env.*` directly
- Update imports to use config

**Estimated Time:** 2-3 hours  
**Risk:** Low (improves reliability)

---

### **STEP 5: Reorganize Project Structure** 📁 (HIGH PRIORITY)

**Why:** Current flat structure makes code hard to navigate and maintain

**Current Structure:**
```
lib/
├── admin-utils.ts
├── ai-service.ts
├── auth-service.ts
├── auth-utils.ts
├── secure-auth-utils.ts
├── security-middleware.ts
├── security-utils.ts
├── ... (20+ more files)
```

**Target Structure:**
```
features/
├── auth/
│   ├── components/
│   ├── hooks/
│   ├── utils/
│   └── types.ts
├── prompts/
│   ├── components/
│   ├── hooks/
│   └── api/
├── admin/
│   ├── components/
│   └── utils/
└── payments/
    ├── components/
    └── utils/
lib/
├── supabase/
│   ├── client.ts
│   ├── server.ts
│   └── middleware.ts
├── config/
└── utils/ (shared only)
```

**Implementation Tasks:**
1. Create feature directories
2. Move auth-related files to `features/auth/`
3. Move prompt-related files to `features/prompts/`
4. Move admin files to `features/admin/`
5. Move payment files to `features/payments/`
6. Update all imports with new paths
7. Create barrel exports (index.ts) for each feature

**Files to Move:**
- Auth: `auth-service.ts`, `secure-auth-utils.ts`, `auth-errors.ts`, etc.
- Prompts: `ai-service.ts`, `openai.ts`
- Admin: `admin-utils.ts`
- Payments: `payments.ts`

**Estimated Time:** 4-5 hours  
**Risk:** High (many file moves, import updates)  
**Note:** Should be done with version control to track changes

---

### **STEP 6: Add Component Variant System (CVA)** 🎨 (MEDIUM PRIORITY)

**Why:** Consistent, type-safe component APIs

**Current Issues:**
- Manual class combinations
- No variant system
- Inconsistent component styling
- Hard to maintain design system

**Reference Implementation:**
```tsx
const buttonVariants = cva(
  'inline-flex items-center justify-center...',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary/90',
        destructive: 'bg-destructive text-destructive-foreground',
        outline: 'border-input bg-background hover:bg-accent',
      },
      size: {
        default: 'h-9 px-4 py-2',
        sm: 'h-8 px-3 text-xs',
        lg: 'h-10 px-8',
      },
    },
  }
);

export function Button({ variant, size, ...props }) {
  return <button className={buttonVariants({ variant, size })} {...props} />;
}
```

**Implementation Tasks:**
1. Install `class-variance-authority`
2. Update `components/ui/button.tsx` with CVA
3. Update `components/ui/input.tsx` with CVA
4. Update `components/ui/card.tsx` with CVA
5. Create variant types for all UI components
6. Update usage across app

**Files to Modify:**
- `components/ui/button.tsx`
- `components/ui/input.tsx`
- `components/ui/card.tsx`
- `package.json`

**Estimated Time:** 2-3 hours  
**Risk:** Low (enhances existing components)

---

### **STEP 7: Enhance Database Security** 🔐 (HIGH PRIORITY)

**Why:** Reference has enterprise-grade database security

**Current Gaps:**
- No private schema for internal functions
- Basic RLS policies
- No field-level protection
- Public schema has default privileges

**Reference Implementation:**
```sql
-- Create private schema
create schema if not exists kit;

-- Revoke all default privileges
alter default privileges revoke execute on functions from public;
revoke all on schema public from public;

-- Granular RLS
create policy accounts_read on public.accounts 
  for select to authenticated 
  using ((select auth.uid()) = id);

-- Protected fields trigger
create function kit.protect_account_fields() returns trigger as $$
begin
  if new.id <> old.id or new.email <> old.email then
    raise exception 'Cannot update protected fields';
  end if;
  return NEW;
end $$ language plpgsql security definer;
```

**Implementation Tasks:**
1. Create new migration: `migration/020_enhanced_security.sql`
2. Add private schema `promptok` for internal functions
3. Revoke default public privileges
4. Add granular RLS policies for all tables
5. Create field protection triggers
6. Move existing functions to private schema
7. Test all database operations

**Files to Create:**
- `migration/020_enhanced_security.sql`
- `migration/021_rls_policies.sql`

**Estimated Time:** 3-4 hours  
**Risk:** High (database changes)  
**Note:** Test thoroughly in development first

---

### **STEP 8: Consolidate Database Migrations** 📊 (MEDIUM PRIORITY)

**Why:** 17 separate migrations are hard to understand

**Current State:**
- 17 migration files
- Some fix issues from previous ones
- Hard to see complete schema

**Target State:**
- Single comprehensive schema file for new deployments
- Keep incremental migrations for existing databases
- Clear documentation

**Implementation Tasks:**
1. Create `migration/000_complete_schema.sql` with full schema
2. Document all tables, functions, triggers
3. Add comments explaining each section
4. Create migration guide for existing deployments
5. Test fresh database setup

**Files to Create:**
- `migration/000_complete_schema.sql`
- `migration/MIGRATION_GUIDE.md`

**Estimated Time:** 2-3 hours  
**Risk:** Low (documentation mostly)

---

### **STEP 9: Add i18n Foundation** 🌍 (LOW PRIORITY)

**Why:** Prepare for internationalization

**Current State:**
- Hardcoded English strings
- No i18n support

**Reference Implementation:**
```tsx
<Trans i18nKey={'auth:signInHeading'} />
<Trans i18nKey={'auth:doNotHaveAccountYet'} />
```

**Implementation Tasks:**
1. Install `react-i18next` and `next-i18next`
2. Create `lib/i18n/` directory
3. Create translation files: `en/common.json`, `en/auth.json`
4. Create i18n provider
5. Wrap key components with `Trans`
6. Document i18n usage

**Files to Create:**
- `lib/i18n/config.ts`
- `lib/i18n/translations/en/common.json`
- `lib/i18n/translations/en/auth.json`
- `components/providers/i18n-provider.tsx`

**Estimated Time:** 3-4 hours  
**Risk:** Low (foundation only)

---

## Implementation Order

### Phase 1: Critical Security & Infrastructure (Week 1)
1. **Step 1:** CSRF Protection (1-2 hours)
2. **Step 4:** Type-Safe Configuration (2-3 hours)
3. **Step 7:** Database Security (3-4 hours)

### Phase 2: Architecture & Code Quality (Week 2)
4. **Step 2:** React Query (2-3 hours)
5. **Step 3:** Refactor Auth Components (3-4 hours)
6. **Step 6:** Component Variants (2-3 hours)

### Phase 3: Organization & Future-Proofing (Week 3)
7. **Step 5:** Project Structure (4-5 hours)
8. **Step 8:** Consolidate Migrations (2-3 hours)
9. **Step 9:** i18n Foundation (3-4 hours)

**Total Estimated Time:** 24-31 hours

---

## Testing Strategy

After each step:
1. **Manual Testing:** Test affected features in browser
2. **Type Checking:** Run `npm run typecheck`
3. **Build Test:** Run `npm run build`
4. **API Testing:** Test API routes with curl/Postman
5. **Database Testing:** Verify RLS policies work correctly

---

## Rollback Plan

Each step will:
1. Create a new git branch: `improvement/step-N-description`
2. Commit changes incrementally
3. Tag before major changes: `pre-step-N`
4. Document rollback steps if needed

---

## Success Metrics

After completion:
- ✅ All forms protected with CSRF
- ✅ Zero direct `process.env` usage (all via config)
- ✅ All API calls use React Query hooks
- ✅ No components over 150 lines
- ✅ Container/Presentation pattern for all forms
- ✅ Type-safe configuration catches errors at build time
- ✅ Database has private schema and granular RLS
- ✅ Feature-based folder structure
- ✅ Component variant system for all UI components

---

## Notes

- **Preserve Existing Features:** All improvements maintain current functionality
- **Backward Compatibility:** Changes are additive where possible
- **User Approval Required:** Wait for approval after each step
- **Best Practices:** Follow patterns from nextjs-saas-starter-kit-lite
- **Code Style:** Maintain 2-space indentation, single quotes, proper TypeScript
- **Security First:** Your existing security (rate limiting, audit logs) is excellent - we're adding to it

---

## Reference Resources

- **Codebase Analysis:** See comparison document
- **Reference Repo:** nextjs-saas-starter-kit-lite
- **Your Strengths:** Rate limiting, audit logging, timing attack prevention
- **Their Strengths:** Architecture, modularity, type safety

---

**Ready to Begin:** Awaiting approval to start Step 1 (CSRF Protection)
