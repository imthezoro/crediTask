-- 008_alter_signups_expected_usage.sql
alter table public.signups
  alter column expected_usage type int using nullif(trim(expected_usage), '')::int;