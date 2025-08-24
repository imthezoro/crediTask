-- 009_add_type_to_signups.sql
alter table public.signups
  add column if not exists type text not null default 'general';
