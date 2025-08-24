-- 010_soft_delete_user_profiles.sql
-- Purpose: introduce soft delete on user_profiles and tighten RLS to block inactive users

begin;

-- Add soft-delete columns
alter table public.user_profiles
  add column if not exists is_active boolean not null default true,
  add column if not exists deleted_at timestamptz null;

-- Replace user_profiles policies to respect is_active
drop policy if exists "user can read own profile" on public.user_profiles;
drop policy if exists "user can update own profile" on public.user_profiles;

create policy "user can read own profile"
  on public.user_profiles
  for select
  using (
    auth.uid() = id
    and is_active = true
  );

-- Allow users to update their own active profile (including setting is_active=false)
create policy "user can update own profile"
  on public.user_profiles
  for update
  using (
    auth.uid() = id
    and is_active = true
  )
  with check (
    auth.uid() = id
  );

commit;
