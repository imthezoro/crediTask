-- 018_atomic_usage_increment.sql
-- Purpose: Add atomic, concurrency-safe usage counter increment with limit enforcement

BEGIN;

-- Create a function that atomically checks prompt_limit and increments usage_count
CREATE OR REPLACE FUNCTION public.increment_usage_if_allowed(
  p_user_id uuid,
  p_increment int DEFAULT 1
)
RETURNS TABLE(
  new_usage int,
  quota int,
  allowed boolean
)
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_limit int;
  v_usage int;
BEGIN
  -- Lock the user row to avoid race conditions
  SELECT usage_count, prompt_limit
    INTO v_usage, v_limit
  FROM public.user_profiles
  WHERE id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    -- No profile; deny increment
    RETURN QUERY SELECT NULL::int, NULL::int, false;
    RETURN;
  END IF;

  -- Unlimited if limit is NULL
  IF v_limit IS NULL THEN
    UPDATE public.user_profiles
    SET usage_count = COALESCE(usage_count, 0) + p_increment,
        updated_at = NOW()
    WHERE id = p_user_id
    RETURNING usage_count INTO v_usage;

    RETURN QUERY SELECT v_usage, v_limit, true;
    RETURN;
  END IF;

  -- Enforce numeric limit
  IF COALESCE(v_usage, 0) + p_increment <= v_limit THEN
    UPDATE public.user_profiles
    SET usage_count = COALESCE(usage_count, 0) + p_increment,
        updated_at = NOW()
    WHERE id = p_user_id
    RETURNING usage_count INTO v_usage;

    RETURN QUERY SELECT v_usage, v_limit, true;
    RETURN;
  ELSE
    -- Would exceed limit
    RETURN QUERY SELECT v_usage, v_limit, false;
    RETURN;
  END IF;
END;
$$;

-- Security note:
-- Do NOT grant to anon/authenticated because this function runs as SECURITY DEFINER
-- and directly updates user_profiles. It should be called only from trusted server
-- contexts (edge functions or server) via the service role key.
-- If any prior grant existed, explicitly revoke it.
REVOKE EXECUTE ON FUNCTION public.increment_usage_if_allowed(uuid, int) FROM PUBLIC, anon, authenticated;

COMMIT;
