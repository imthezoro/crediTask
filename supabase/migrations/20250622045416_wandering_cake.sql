/*
  # Application Bucket and Auto-Assignment System

  1. New Tables
    - `application_buckets` - Groups applications by project/task for client review
    - `auto_assignment_timers` - Tracks auto-assignment timers for tasks
    
  2. Enhanced Tables
    - Add `application_window_minutes` to tasks for auto-assignment timing
    - Add `bucket_id` to task_applications to group them
    - Add `selected` status to task_applications
    
  3. Functions
    - Auto-assignment evaluation logic
    - Application bucket management
    - Timer management for auto-assignment
*/

-- Application buckets to group applications per project/task
CREATE TABLE IF NOT EXISTS application_buckets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  task_id uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  total_applications integer DEFAULT 0,
  reviewed_applications integer DEFAULT 0,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'reviewing', 'closed')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(task_id)
);

-- Auto-assignment timers for tasks with auto-assignment enabled
CREATE TABLE IF NOT EXISTS auto_assignment_timers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  application_window_minutes integer NOT NULL DEFAULT 60,
  window_start timestamptz NOT NULL DEFAULT now(),
  window_end timestamptz NOT NULL,
  extensions_count integer DEFAULT 0,
  max_extensions integer DEFAULT 5,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(task_id)
);

-- Add new columns to existing tables
DO $$
BEGIN
  -- Add application window to tasks
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tasks' AND column_name = 'application_window_minutes'
  ) THEN
    ALTER TABLE tasks ADD COLUMN application_window_minutes integer DEFAULT 60;
  END IF;

  -- Add bucket reference to task applications
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'task_applications' AND column_name = 'bucket_id'
  ) THEN
    ALTER TABLE task_applications ADD COLUMN bucket_id uuid REFERENCES application_buckets(id) ON DELETE SET NULL;
  END IF;

  -- Add selection status to task applications
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'task_applications' AND column_name = 'selected'
  ) THEN
    ALTER TABLE task_applications ADD COLUMN selected boolean DEFAULT false;
  END IF;

  -- Add review status to task applications
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'task_applications' AND column_name = 'reviewed'
  ) THEN
    ALTER TABLE task_applications ADD COLUMN reviewed boolean DEFAULT false;
  END IF;
END $$;

-- Enable RLS on new tables
ALTER TABLE application_buckets ENABLE ROW LEVEL SECURITY;
ALTER TABLE auto_assignment_timers ENABLE ROW LEVEL SECURITY;

-- Application buckets policies
CREATE POLICY "Clients can view own application buckets"
  ON application_buckets
  FOR SELECT
  TO authenticated
  USING (client_id = auth.uid());

CREATE POLICY "Clients can manage own application buckets"
  ON application_buckets
  FOR ALL
  TO authenticated
  USING (client_id = auth.uid());

-- Auto-assignment timers policies
CREATE POLICY "Clients can view timers for own tasks"
  ON auto_assignment_timers
  FOR SELECT
  TO authenticated
  USING (
    task_id IN (
      SELECT t.id FROM tasks t
      JOIN projects p ON t.project_id = p.id
      WHERE p.client_id = auth.uid()
    )
  );

CREATE POLICY "System can manage auto-assignment timers"
  ON auto_assignment_timers
  FOR ALL
  TO authenticated
  USING (true);

-- Function to create or get application bucket for a task
CREATE OR REPLACE FUNCTION get_or_create_application_bucket(
  p_task_id uuid
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  bucket_id uuid;
  task_record record;
BEGIN
  -- Get task and project info
  SELECT t.*, p.client_id INTO task_record
  FROM tasks t
  JOIN projects p ON t.project_id = p.id
  WHERE t.id = p_task_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Task not found: %', p_task_id;
  END IF;
  
  -- Check if bucket already exists
  SELECT id INTO bucket_id
  FROM application_buckets
  WHERE task_id = p_task_id;
  
  -- Create bucket if it doesn't exist
  IF bucket_id IS NULL THEN
    INSERT INTO application_buckets (project_id, task_id, client_id)
    VALUES (task_record.project_id, p_task_id, task_record.client_id)
    RETURNING id INTO bucket_id;
  END IF;
  
  RETURN bucket_id;
END;
$$;

-- Function to calculate worker score for auto-assignment
CREATE OR REPLACE FUNCTION calculate_application_score(
  worker_skills text[],
  required_skills text[],
  worker_rating numeric,
  application_time timestamptz
) RETURNS TABLE(
  skill_score numeric,
  rating_score numeric,
  time_bonus numeric,
  total_score numeric
) AS $$
DECLARE
  matched_skills integer := 0;
  total_required integer;
  skill_match_ratio numeric;
  time_bonus_val numeric := 0;
BEGIN
  -- Count matching skills
  SELECT COUNT(*)
  INTO matched_skills
  FROM unnest(worker_skills) AS ws
  WHERE ws = ANY(required_skills);
  
  -- Get total required skills
  total_required := array_length(required_skills, 1);
  
  -- Calculate skill match ratio
  IF total_required = 0 OR total_required IS NULL THEN
    skill_match_ratio := 1.0;
  ELSE
    skill_match_ratio := matched_skills::numeric / total_required::numeric;
  END IF;
  
  -- Calculate time bonus (earlier applications get slight bonus)
  time_bonus_val := GREATEST(0, 1.0 - EXTRACT(EPOCH FROM (now() - application_time)) / 86400.0) * 0.1;
  
  RETURN QUERY SELECT
    skill_match_ratio as skill_score,
    COALESCE(worker_rating, 0) as rating_score,
    time_bonus_val as time_bonus,
    (skill_match_ratio * COALESCE(worker_rating, 0)) + time_bonus_val as total_score;
END;
$$ LANGUAGE plpgsql;

-- Function to evaluate and auto-assign task
CREATE OR REPLACE FUNCTION evaluate_auto_assignment(
  p_task_id uuid
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  task_record record;
  best_worker_id uuid;
  best_score numeric := -1;
  application_record record;
  score_result record;
  assignment_count integer;
BEGIN
  -- Get task details
  SELECT t.*, p.client_id INTO task_record
  FROM tasks t
  JOIN projects p ON t.project_id = p.id
  WHERE t.id = p_task_id 
    AND t.status = 'open' 
    AND t.auto_assign = true;
  
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;
  
  -- Count applications for this task
  SELECT COUNT(*) INTO assignment_count
  FROM task_applications ta
  WHERE ta.task_id = p_task_id;
  
  -- If no applications, return null
  IF assignment_count = 0 THEN
    RETURN NULL;
  END IF;
  
  -- If only one application, assign directly
  IF assignment_count = 1 THEN
    SELECT ta.worker_id INTO best_worker_id
    FROM task_applications ta
    WHERE ta.task_id = p_task_id;
  ELSE
    -- Evaluate all applications and find best candidate
    FOR application_record IN
      SELECT ta.*, u.skills, u.rating
      FROM task_applications ta
      JOIN users u ON ta.worker_id = u.id
      WHERE ta.task_id = p_task_id
      ORDER BY ta.applied_at ASC
    LOOP
      -- Calculate score for this application
      SELECT * INTO score_result
      FROM calculate_application_score(
        application_record.skills,
        task_record.required_skills,
        application_record.rating,
        application_record.applied_at
      );
      
      -- Update best candidate if this score is higher
      IF score_result.total_score > best_score THEN
        best_score := score_result.total_score;
        best_worker_id := application_record.worker_id;
      END IF;
    END LOOP;
  END IF;
  
  -- Assign task to best worker
  IF best_worker_id IS NOT NULL THEN
    -- Update task
    UPDATE tasks
    SET assignee_id = best_worker_id, status = 'assigned'
    WHERE id = p_task_id;
    
    -- Mark selected application
    UPDATE task_applications
    SET selected = true
    WHERE task_id = p_task_id AND worker_id = best_worker_id;
    
    -- Mark other applications as not selected
    UPDATE task_applications
    SET selected = false
    WHERE task_id = p_task_id AND worker_id != best_worker_id;
    
    -- Update application bucket status
    UPDATE application_buckets
    SET status = 'closed'
    WHERE task_id = p_task_id;
    
    -- Mark auto-assignment timer as completed
    UPDATE auto_assignment_timers
    SET status = 'completed'
    WHERE task_id = p_task_id;
    
    -- Create notification for selected worker
    INSERT INTO notifications (user_id, title, message, type)
    VALUES (
      best_worker_id,
      'Task Auto-Assigned',
      'You have been automatically assigned to task: ' || task_record.title,
      'success'
    );
    
    -- Create notifications for non-selected workers
    INSERT INTO notifications (user_id, title, message, type)
    SELECT 
      ta.worker_id,
      'Application Not Selected',
      'Your application for "' || task_record.title || '" was not selected.',
      'info'
    FROM task_applications ta
    WHERE ta.task_id = p_task_id AND ta.worker_id != best_worker_id;
  END IF;
  
  RETURN best_worker_id;
END;
$$ LANGUAGE plpgsql;

-- Function to start auto-assignment timer
CREATE OR REPLACE FUNCTION start_auto_assignment_timer(
  p_task_id uuid
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  timer_id uuid;
  task_record record;
  window_minutes integer;
BEGIN
  -- Get task details
  SELECT * INTO task_record
  FROM tasks
  WHERE id = p_task_id AND status = 'open' AND auto_assign = true;
  
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;
  
  -- Get application window (default 60 minutes)
  window_minutes := COALESCE(task_record.application_window_minutes, 60);
  
  -- Create timer
  INSERT INTO auto_assignment_timers (
    task_id,
    application_window_minutes,
    window_start,
    window_end
  ) VALUES (
    p_task_id,
    window_minutes,
    now(),
    now() + (window_minutes || ' minutes')::interval
  )
  RETURNING id INTO timer_id;
  
  RETURN timer_id;
END;
$$ LANGUAGE plpgsql;

-- Function to extend auto-assignment timer
CREATE OR REPLACE FUNCTION extend_auto_assignment_timer(
  p_task_id uuid
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  timer_record record;
  new_window_end timestamptz;
BEGIN
  -- Get current timer
  SELECT * INTO timer_record
  FROM auto_assignment_timers
  WHERE task_id = p_task_id AND status = 'active';
  
  IF NOT FOUND THEN
    RETURN false;
  END IF;
  
  -- Check if we can extend (max extensions limit)
  IF timer_record.extensions_count >= timer_record.max_extensions THEN
    RETURN false;
  END IF;
  
  -- Calculate new window end
  new_window_end := timer_record.window_end + (timer_record.application_window_minutes || ' minutes')::interval;
  
  -- Update timer
  UPDATE auto_assignment_timers
  SET 
    window_end = new_window_end,
    extensions_count = extensions_count + 1,
    updated_at = now()
  WHERE id = timer_record.id;
  
  RETURN true;
END;
$$ LANGUAGE plpgsql;

-- Function to process auto-assignment timers (to be called by cron job)
CREATE OR REPLACE FUNCTION process_auto_assignment_timers()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  timer_record record;
  application_count integer;
  assigned_worker_id uuid;
  processed_count integer := 0;
BEGIN
  -- Process all active timers that have expired
  FOR timer_record IN
    SELECT * FROM auto_assignment_timers
    WHERE status = 'active' AND window_end <= now()
  LOOP
    -- Check if task has applications
    SELECT COUNT(*) INTO application_count
    FROM task_applications
    WHERE task_id = timer_record.task_id;
    
    IF application_count = 0 THEN
      -- No applications, try to extend timer
      IF extend_auto_assignment_timer(timer_record.task_id) THEN
        -- Timer extended successfully
        CONTINUE;
      ELSE
        -- Max extensions reached, cancel auto-assignment
        UPDATE auto_assignment_timers
        SET status = 'cancelled'
        WHERE id = timer_record.id;
        
        UPDATE tasks
        SET auto_assign = false
        WHERE id = timer_record.task_id;
      END IF;
    ELSE
      -- Applications exist, evaluate and assign
      assigned_worker_id := evaluate_auto_assignment(timer_record.task_id);
      
      IF assigned_worker_id IS NOT NULL THEN
        processed_count := processed_count + 1;
      END IF;
    END IF;
  END LOOP;
  
  RETURN processed_count;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_application_buckets_updated_at
  BEFORE UPDATE ON application_buckets
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_auto_assignment_timers_updated_at
  BEFORE UPDATE ON auto_assignment_timers
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger to create application bucket and timer when task is created with auto_assign
CREATE OR REPLACE FUNCTION handle_new_auto_assign_task()
RETURNS TRIGGER AS $$
DECLARE
  bucket_id uuid;
  timer_id uuid;
BEGIN
  -- Only process if auto_assign is true and status is open
  IF NEW.auto_assign = true AND NEW.status = 'open' THEN
    -- Create application bucket
    bucket_id := get_or_create_application_bucket(NEW.id);
    
    -- Start auto-assignment timer
    timer_id := start_auto_assignment_timer(NEW.id);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_new_auto_assign_task
  AFTER INSERT ON tasks
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_auto_assign_task();

-- Trigger to update application bucket when new application is added
CREATE OR REPLACE FUNCTION handle_new_task_application()
RETURNS TRIGGER AS $$
DECLARE
  bucket_id uuid;
BEGIN
  -- Get or create application bucket
  bucket_id := get_or_create_application_bucket(NEW.task_id);
  
  -- Link application to bucket
  NEW.bucket_id := bucket_id;
  
  -- Update bucket application count
  UPDATE application_buckets
  SET 
    total_applications = total_applications + 1,
    updated_at = now()
  WHERE id = bucket_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_new_task_application
  BEFORE INSERT ON task_applications
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_task_application();

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION get_or_create_application_bucket(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION calculate_application_score(text[], text[], numeric, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION evaluate_auto_assignment(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION start_auto_assignment_timer(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION extend_auto_assignment_timer(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION process_auto_assignment_timers() TO authenticated;