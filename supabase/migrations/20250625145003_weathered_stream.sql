/*
  # Add application status management

  1. Schema Updates
    - Add status enum to task_applications table
    - Update existing records to have proper status
    - Add indexes for better performance

  2. Status Logic
    - pending: Initial state when application is submitted
    - approved: Application was accepted and task assigned
    - rejected: Application was declined
*/

-- Add status column to task_applications
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'task_applications' AND column_name = 'status'
  ) THEN
    ALTER TABLE task_applications 
    ADD COLUMN status text DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected'));
  END IF;
END $$;

-- Update existing records based on reviewed and selected fields
UPDATE task_applications 
SET status = CASE 
  WHEN reviewed = true AND selected = true THEN 'approved'
  WHEN reviewed = true AND selected = false THEN 'rejected'
  ELSE 'pending'
END
WHERE status = 'pending';

-- Add index for better performance
CREATE INDEX IF NOT EXISTS idx_task_applications_status ON task_applications(status);

-- Update the application buckets to track status properly
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'application_buckets' AND column_name = 'approved_applications'
  ) THEN
    ALTER TABLE application_buckets 
    ADD COLUMN approved_applications integer DEFAULT 0,
    ADD COLUMN rejected_applications integer DEFAULT 0;
  END IF;
END $$;

-- Update bucket counts
UPDATE application_buckets 
SET 
  approved_applications = (
    SELECT COUNT(*) FROM task_applications 
    WHERE bucket_id = application_buckets.id AND status = 'approved'
  ),
  rejected_applications = (
    SELECT COUNT(*) FROM task_applications 
    WHERE bucket_id = application_buckets.id AND status = 'rejected'
  ),
  reviewed_applications = (
    SELECT COUNT(*) FROM task_applications 
    WHERE bucket_id = application_buckets.id AND status IN ('approved', 'rejected')
  );