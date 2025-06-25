/*
  # Fix Application Buckets and Task Applications

  1. Ensure application_buckets table has all required columns
  2. Add proper constraints and indexes
  3. Fix any missing foreign key relationships
  4. Update existing data to be consistent
*/

-- Ensure application_buckets has all required columns
DO $$
BEGIN
  -- Add approved_applications column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'application_buckets' AND column_name = 'approved_applications'
  ) THEN
    ALTER TABLE application_buckets ADD COLUMN approved_applications integer DEFAULT 0;
  END IF;

  -- Add rejected_applications column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'application_buckets' AND column_name = 'rejected_applications'
  ) THEN
    ALTER TABLE application_buckets ADD COLUMN rejected_applications integer DEFAULT 0;
  END IF;
END $$;

-- Ensure task_applications has status column with proper constraint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'task_applications' AND column_name = 'status'
  ) THEN
    ALTER TABLE task_applications 
    ADD COLUMN status text DEFAULT 'pending' 
    CHECK (status IN ('pending', 'approved', 'rejected'));
  END IF;
END $$;

-- Update existing task_applications records to have proper status
UPDATE task_applications 
SET status = CASE 
  WHEN reviewed = true AND selected = true THEN 'approved'
  WHEN reviewed = true AND selected = false THEN 'rejected'
  ELSE 'pending'
END
WHERE status IS NULL OR status = 'pending';

-- Update application bucket counts to be accurate
UPDATE application_buckets 
SET 
  total_applications = COALESCE((
    SELECT COUNT(*) FROM task_applications 
    WHERE bucket_id = application_buckets.id
  ), 0),
  approved_applications = COALESCE((
    SELECT COUNT(*) FROM task_applications 
    WHERE bucket_id = application_buckets.id AND status = 'approved'
  ), 0),
  rejected_applications = COALESCE((
    SELECT COUNT(*) FROM task_applications 
    WHERE bucket_id = application_buckets.id AND status = 'rejected'
  ), 0),
  reviewed_applications = COALESCE((
    SELECT COUNT(*) FROM task_applications 
    WHERE bucket_id = application_buckets.id AND status IN ('approved', 'rejected')
  ), 0);

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_task_applications_status ON task_applications(status);
CREATE INDEX IF NOT EXISTS idx_task_applications_bucket_id ON task_applications(bucket_id);
CREATE INDEX IF NOT EXISTS idx_task_applications_worker_task ON task_applications(worker_id, task_id);

-- Ensure proposals table has status column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'proposals' AND column_name = 'status'
  ) THEN
    ALTER TABLE proposals 
    ADD COLUMN status text DEFAULT 'pending' 
    CHECK (status IN ('pending', 'accepted', 'rejected'));
  END IF;
END $$;

-- Update existing proposals to have proper status
UPDATE proposals 
SET status = CASE 
  WHEN status IS NULL THEN 'pending'
  ELSE status
END;