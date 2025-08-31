-- Purpose: Update RLS policies to restrict anonymous users from payments while allowing other access

BEGIN;

-- ============================
-- Update payments RLS to exclude anonymous users
-- ============================

-- Drop existing payment policies
DROP POLICY IF EXISTS "active user can read own payments" ON public.payments;
DROP POLICY IF EXISTS "active user can insert own payments" ON public.payments;

-- Create new policies that exclude anonymous users
CREATE POLICY "permanent user can read own payments"
  ON public.payments
  FOR SELECT
  USING (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.user_profiles up
      WHERE up.id = auth.uid() AND up.is_active = true
    )
    AND COALESCE((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
  );

CREATE POLICY "permanent user can insert own payments"
  ON public.payments
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.user_profiles up
      WHERE up.id = auth.uid() AND up.is_active = true
    )
    AND COALESCE((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
  );

-- Add update and delete policies for payments (if needed)
CREATE POLICY "permanent user can update own payments"
  ON public.payments
  FOR UPDATE
  USING (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.user_profiles up
      WHERE up.id = auth.uid() AND up.is_active = true
    )
    AND COALESCE((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
  )
  WITH CHECK (
    auth.uid() = user_id
    AND COALESCE((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
  );

CREATE POLICY  "permanent user can delete own payments"
  ON public.payments
  FOR DELETE
  USING (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.user_profiles up
      WHERE up.id = auth.uid() AND up.is_active = true
    )
    AND COALESCE((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
  );

-- ============================
-- Ensure prompt_sessions allows both anonymous and permanent users
-- ============================
-- (Current policies already allow this via auth.uid() check)

-- ============================
-- Add comments for documentation
-- ============================
COMMENT ON POLICY "permanent user can read own payments" ON public.payments IS 
  'Only permanent (non-anonymous) users can read their payment records';

COMMENT ON POLICY "permanent user can insert own payments" ON public.payments IS 
  'Only permanent (non-anonymous) users can create payment records';

COMMIT;
