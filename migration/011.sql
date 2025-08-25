-- 011_blocked_emails_table.sql
-- Purpose: Create blocked_emails table to prevent immediate re-signup after deactivation

begin;

-- Create blocked_emails table
create table if not exists public.blocked_emails (
  email text primary key,
  blocked_until timestamptz not null,
  created_at timestamptz default now()
);


-- RLS: Only service role can write to blocked_emails (no client access)
alter table public.blocked_emails enable row level security;

-- No policies = only service role can access (bypasses RLS)
-- This ensures clients cannot manipulate blocked emails

commit;
