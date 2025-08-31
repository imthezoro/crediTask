# PromptOK Anonymous (Guest) Authentication — Design & Implementation Plan

This document proposes a complete, safe integration of Supabase Anonymous Sign-Ins ("guest accounts") into PromptOK.

It is tailored to this codebase and existing auth/soft-delete patterns and aims for:
- Anonymous one-click sign-in for demo/trial.
- Clear RLS boundaries between anonymous and permanent users.
- No guest-to-permanent conversion. Guests can later create a separate permanent account via the regular signup flow. No data migration.
- Compatibility with existing soft delete, session revocation, and blocked email logic.

References:
- Supabase Docs: Anonymous Sign-Ins — https://supabase.com/docs/guides/auth/auth-anonymous
- Existing files: `app/auth/signin/page.tsx`, `app/auth/callback/page.tsx`, `app/api/auth/guest-login/route.ts`, `app/api/auth/check-guest-creation/route.ts`, `lib/auth-service.ts`, `middleware.ts`

---

## 1) High-level Design

- Enable Supabase Anonymous Sign-Ins at the project level (dashboard).
- Client shows a "Continue as Guest" button in `LoginForm` that hits `/api/auth/guest-login`.
- The route performs `supabase.auth.signInAnonymously()` using the server client and sets HttpOnly cookies, consistent with other auth routes.
- Alternative: The client can call `signInAnonymously()` directly (Supabase JS sets cookies). If using server route, never return tokens in JSON.
- On first session for an anonymous user, ensure a `user_profiles` row exists with `is_active=true`, `is_guest=true` and proper timestamps.
- Enforce RLS using `auth.jwt() ->> 'is_anonymous'` to distinguish anonymous from permanent users.
- Guest limitations are policy-driven (read/write only to allowed tables or within quotas). Permanent users retain full access per existing policies.
- There is no upgrade/merge. If users want a permanent account, they sign up fresh on the signup page. Guest data is ephemeral and may be cleaned up.
- Existing soft-delete/session-revocation checks continue to apply to both anonymous and permanent users.

### Where to call signInAnonymously()
- Server route (`/api/auth/guest-login`) using the Supabase server client with Next cookies (preferred for central control, rate limiting, CAPTCHA, and audit).
- Or client-side call if you want fewer hops. Ensure dynamic rendering to avoid cross-user caching.

---

## 2) Prerequisites

- Supabase Dashboard → Auth → Providers → Enable "Anonymous sign-ins".
- Next.js rendering: prefer dynamic rendering for pages that depend on `auth.getSession()` to avoid caching cross-user metadata (per Supabase guidance).

```tsx
// Example: ensure dynamic rendering in pages that render auth state
export const dynamic = 'force-dynamic'
```

---

## 3) Database Schema Additions

We already rely on `user_profiles` (queried in `app/auth/callback/page.tsx`). Keep it simple by reusing existing columns:

- `is_guest` already exists (see `migration/005.sql`).
- `is_active`, `deleted_at` already exist (see `migration/010.sql`).

Minimal migration (optional, for performance/analytics on guest rows):

```sql
-- 016_anonymous_auth.sql (minimal)
-- Only add an index to speed up queries/cleanup over guest rows
create index if not exists idx_user_profiles_is_guest
  on public.user_profiles (is_guest) where is_guest = true;
```

Notes:
- No new lifecycle columns (e.g., `guest_created_at/last_active_at/expires_at`) are required.
- Guest cleanup can be handled manually via Admin API using `auth.users.created_at` and/or app activity, as needed.
- No conversion columns are required (no upgrade flow).
- Anonymous users authenticate with the `authenticated` Postgres role.
- Their JWT includes an `is_anonymous` claim. Use it in RLS to distinguish access.
- Prefer deny-by-default: enable RLS and create explicit allow policies only.

General helpers:

```sql
-- Helper expressions used in policies
-- auth.uid() gives the current user id
-- coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) distinguishes anonymous users safely
```

Policy templates by table category:

1) Profiles (`public.user_profiles`)
```sql
alter table public.user_profiles enable row level security;

-- Select own profile when not soft-deleted
create policy if not exists user_profiles_select_self
on public.user_profiles for select
using (
  id = auth.uid()
  and coalesce(deleted_at, '-infinity') = '-infinity'
);

-- Insert by backend only (avoid clients creating arbitrary profiles)
create policy if not exists user_profiles_insert_backend_only
on public.user_profiles for insert
to service_role
with check (true);

-- If client upsert is desired, restrict strictly to own id and limited columns via views or triggers.

-- Update own profile with restrictions (no privilege escalation via client)
create policy if not exists user_profiles_update_self
on public.user_profiles for update
using (id = auth.uid())
with check (id = auth.uid());
```

2) Product data owned by user (example: `public.documents`)
```sql
alter table public.documents enable row level security;

-- Permanent users: full CRUD to own docs (respect existing constraints)
-- Anonymous users: allow only a subset (e.g., read/write own, subject to quotas enforced by API)

create policy if not exists documents_select_own
on public.documents for select
using (
  user_id = auth.uid()
);

create policy if not exists documents_insert_own
on public.documents for insert
with check (
  user_id = auth.uid()
);

create policy if not exists documents_update_own
on public.documents for update
using (
  user_id = auth.uid()
)
with check (
  user_id = auth.uid()
);

create policy if not exists documents_delete_own
on public.documents for delete
using (
  user_id = auth.uid()
);
```

Restricting anonymous users to certain tables/columns:
```sql
-- Example: disallow anonymous users from writing to a premium table
create policy if not exists premium_inserts_permanent_only
on public.premium_features for insert
with check (
  coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
);
```

If you need to narrow read access for anonymous users:
```sql
-- Example: allow selects only when NOT anonymous
create policy if not exists premium_selects_permanent_only
on public.premium_features for select
using (
  coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
);
```

Payments table: block anonymous users from making changes (writes) while keeping existing reads/inserts for permanent users aligned with `migration/012.sql`:
```sql
-- Ensure RLS is enabled (already enabled in migrations)
alter table public.payments enable row level security;

-- Replace the insert policy to exclude anonymous users explicitly
drop policy if exists "active user can insert own payments" on public.payments;
create policy "permanent user can insert own payments"
  on public.payments
  for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.user_profiles up
      where up.id = auth.uid() and up.is_active = true
    )
    and coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
  );

-- Optional: if updates/deletes are ever used, also restrict them to non-anonymous users
create policy if not exists "permanent user can update own payments"
  on public.payments
  for update
  using (
    auth.uid() = user_id
    and exists (
      select 1 from public.user_profiles up
      where up.id = auth.uid() and up.is_active = true
    )
    and coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
  )
  with check (
    auth.uid() = user_id
    and coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
  );

create policy if not exists "permanent user can delete own payments"
  on public.payments
  for delete
  using (
    auth.uid() = user_id
    and exists (
      select 1 from public.user_profiles up
      where up.id = auth.uid() and up.is_active = true
    )
    and coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
  );
```

Important:
- Keep existing RLS for soft-deleted users: ensure `is_active` and `deleted_at` checks remain effective.
- The middleware still rejects soft-deleted or session-revoked users regardless of anonymous/permanent.

---

## 20) Admin Cleanup Job Outline

Optional (only if you later automate). Manual cleanup is acceptable for now.
When/if automated:
- Run with service_role in a secure environment (Edge Function/Cron, not client).
- Strategies without adding new columns:
  - Age-based: use `auth.users.created_at` to find old anonymous accounts.
  - Activity-based: infer from app tables (e.g., latest `prompt_sessions.updated_at` by `user_id`).
- Delete users via Admin API and remove related `auth.sessions`.
- Log aggregated metrics and use backoff on rate limits.

{{ ... }}
