-- 015_update_blocked_emails_for_hard_delete.sql
-- Purpose: Add reason column to blocked_emails table for hard delete tracking

begin;

-- Add reason column to blocked_emails table
alter table public.blocked_emails 
add column if not exists reason text default 'Account deletion';

commit;
