-- 016_add_email_to_user_profiles.sql
-- Purpose: Add email column to user_profiles and backfill from auth.users

BEGIN;

-- ============================
-- 1. Add email column to user_profiles
-- ============================
ALTER TABLE public.user_profiles
ADD COLUMN IF NOT EXISTS email TEXT;

-- ============================
-- 2. Backfill email data from auth.users
-- ============================
UPDATE public.user_profiles p
SET email = u.email
FROM auth.users u
WHERE p.id = u.id AND p.email IS NULL;

-- ============================
-- 3. Update handle_new_user() trigger function to include email
-- ============================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_profiles (id, plan, usage_count, email)
  VALUES (NEW.id, 'free', 0, NEW.email)
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email
  WHERE user_profiles.email IS NULL OR user_profiles.email != EXCLUDED.email;
  RETURN NEW;
END;
$$;


-- ============================
-- 4. Add email to audit_logs backfill for existing records
-- ============================
-- Update existing audit_logs records that might be missing email
UPDATE audit_logs a
SET user_email = u.email
FROM auth.users u
WHERE a.user_id = u.id AND a.user_email IS NULL;

COMMIT;
