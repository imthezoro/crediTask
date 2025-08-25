-- 012_update_rls_policies_for_active_users.sql
-- Purpose: Update RLS policies to check user_profiles.is_active for all user-related tables

begin;

-- ============================
-- Update prompt_sessions RLS to check is_active
-- ============================

-- Drop existing policies
drop policy if exists "user can insert own sessions" on public.prompt_sessions;
drop policy if exists "user can read own sessions" on public.prompt_sessions;
drop policy if exists "user can update own sessions" on public.prompt_sessions;
drop policy if exists "user can delete own sessions" on public.prompt_sessions;

-- Create new policies that check is_active
create policy "active user can insert own sessions"
  on public.prompt_sessions
  for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.user_profiles up
      where up.id = auth.uid() and up.is_active = true
    )
  );

create policy "active user can read own sessions"
  on public.prompt_sessions
  for select
  using (
    auth.uid() = user_id
    and exists (
      select 1 from public.user_profiles up
      where up.id = auth.uid() and up.is_active = true
    )
  );

create policy "active user can update own sessions"
  on public.prompt_sessions
  for update
  using (
    auth.uid() = user_id
    and exists (
      select 1 from public.user_profiles up
      where up.id = auth.uid() and up.is_active = true
    )
  );

create policy "active user can delete own sessions"
  on public.prompt_sessions
  for delete
  using (
    auth.uid() = user_id
    and exists (
      select 1 from public.user_profiles up
      where up.id = auth.uid() and up.is_active = true
    )
  );

-- ============================
-- Update payments RLS to check is_active
-- ============================

-- Drop existing policies
drop policy if exists "user can read own payments" on public.payments;
drop policy if exists "user can insert own payments" on public.payments;

-- Create new policies that check is_active
create policy "active user can read own payments"
  on public.payments
  for select
  using (
    auth.uid() = user_id
    and exists (
      select 1 from public.user_profiles up
      where up.id = auth.uid() and up.is_active = true
    )
  );

create policy "active user can insert own payments"
  on public.payments
  for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.user_profiles up
      where up.id = auth.uid() and up.is_active = true
    )
  );

-- ============================
-- Add RLS policies for other tables that might exist
-- ============================

-- If signups table exists, add policy (it currently allows anon, keep that)
-- No changes needed for signups as it allows anonymous access

-- Note: user_profiles policies are already updated in migration 010

commit;
