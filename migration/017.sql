-- 017_add_prompt_limit_to_user_profiles.sql
-- Purpose: Add per-user prompt_limit column and backfill from existing quota logic

BEGIN;

-- 1) Add column (nullable means unlimited when null)
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS prompt_limit INT NULL;

-- 2) Backfill based on existing rules
--    - Guests: 5
--    - Free (non-guest): 10
--    - Paid plans: NULL (unlimited)
UPDATE public.user_profiles
SET prompt_limit = CASE
  WHEN COALESCE(is_guest, false) = true THEN 5
  WHEN (plan IS NULL OR plan = 'free') THEN 10
  ELSE NULL
END
WHERE prompt_limit IS NULL;

COMMIT;


-- Purpose: Ensure new signups get a default prompt_limit based on plan
-- Notes:
--  - Guests are created via guest-login API; their limit is set there (5)
--  - Regular signups created via auth.users trigger should get 10 by default for free plans

BEGIN;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_profiles (id, plan, usage_count, email, prompt_limit)
  VALUES (NEW.id, 'free', 0, NEW.email, 10)
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    -- Only set prompt_limit if currently NULL so we don't override explicit changes
    prompt_limit = COALESCE(user_profiles.prompt_limit, EXCLUDED.prompt_limit)
  WHERE user_profiles.email IS NULL OR user_profiles.email != EXCLUDED.email OR user_profiles.prompt_limit IS NULL;
  RETURN NEW;
END;
$$;

COMMIT;
