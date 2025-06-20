/*
  # Enhanced FreelanceFlow Features

  1. New Tables
    - `chat_channels` - Project-scoped chat channels
    - `chat_messages` - Real-time messaging system
    - `proposals` - Worker proposals for tasks
    - `invitations` - Client invitations to workers
    - `favorites` - User favorites system
    - `user_tiers` - Worker tier system
    - `task_applications` - Task application tracking

  2. Enhanced Tables
    - Add pricing_type, hourly_rate to tasks
    - Add tier, onboarding_completed to users
    - Add application_deadline to tasks

  3. Security
    - RLS policies for all new tables
    - Secure chat access controls
*/

-- Chat system
CREATE TABLE IF NOT EXISTS chat_channels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name text NOT NULL,
  type text NOT NULL DEFAULT 'project' CHECK (type IN ('project', 'direct')),
  participants uuid[] NOT NULL,
  created_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id uuid NOT NULL REFERENCES chat_channels(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content text NOT NULL,
  message_type text DEFAULT 'text' CHECK (message_type IN ('text', 'file', 'system')),
  file_url text,
  created_at timestamptz DEFAULT now()
);

-- Proposals and invitations
CREATE TABLE IF NOT EXISTS proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  worker_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  cover_letter text NOT NULL,
  proposed_rate numeric(10,2),
  estimated_hours integer,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(task_id, worker_id)
);

CREATE TABLE IF NOT EXISTS invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  worker_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(task_id, worker_id)
);

-- Favorites system
CREATE TABLE IF NOT EXISTS favorites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  favorite_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, favorite_user_id)
);

-- Task applications
CREATE TABLE IF NOT EXISTS task_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  worker_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  applied_at timestamptz DEFAULT now(),
  UNIQUE(task_id, worker_id)
);

-- Add new columns to existing tables
DO $$
BEGIN
  -- Add tier system to users
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'tier'
  ) THEN
    ALTER TABLE users ADD COLUMN tier text DEFAULT 'bronze' CHECK (tier IN ('bronze', 'silver', 'gold', 'platinum'));
  END IF;

  -- Add onboarding completion tracking
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'onboarding_completed'
  ) THEN
    ALTER TABLE users ADD COLUMN onboarding_completed boolean DEFAULT false;
  END IF;

  -- Add pricing options to tasks
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tasks' AND column_name = 'pricing_type'
  ) THEN
    ALTER TABLE tasks ADD COLUMN pricing_type text DEFAULT 'fixed' CHECK (pricing_type IN ('fixed', 'hourly'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tasks' AND column_name = 'hourly_rate'
  ) THEN
    ALTER TABLE tasks ADD COLUMN hourly_rate numeric(10,2);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tasks' AND column_name = 'estimated_hours'
  ) THEN
    ALTER TABLE tasks ADD COLUMN estimated_hours integer;
  END IF;

  -- Add application deadline
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tasks' AND column_name = 'application_deadline'
  ) THEN
    ALTER TABLE tasks ADD COLUMN application_deadline timestamptz;
  END IF;

  -- Add required skills
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tasks' AND column_name = 'required_skills'
  ) THEN
    ALTER TABLE tasks ADD COLUMN required_skills text[] DEFAULT '{}';
  END IF;

  -- Add auto assignment flag
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tasks' AND column_name = 'auto_assign'
  ) THEN
    ALTER TABLE tasks ADD COLUMN auto_assign boolean DEFAULT true;
  END IF;
END $$;

-- Enable RLS on new tables
ALTER TABLE chat_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_applications ENABLE ROW LEVEL SECURITY;

-- Chat policies
CREATE POLICY "Users can view channels they participate in"
  ON chat_channels
  FOR SELECT
  TO authenticated
  USING (auth.uid() = ANY(participants));

CREATE POLICY "Users can create project channels"
  ON chat_channels
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can view messages in their channels"
  ON chat_messages
  FOR SELECT
  TO authenticated
  USING (
    channel_id IN (
      SELECT id FROM chat_channels WHERE auth.uid() = ANY(participants)
    )
  );

CREATE POLICY "Users can send messages to their channels"
  ON chat_messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    channel_id IN (
      SELECT id FROM chat_channels WHERE auth.uid() = ANY(participants)
    )
  );

-- Proposals policies
CREATE POLICY "Workers can manage own proposals"
  ON proposals
  FOR ALL
  TO authenticated
  USING (worker_id = auth.uid());

CREATE POLICY "Clients can view proposals for their tasks"
  ON proposals
  FOR SELECT
  TO authenticated
  USING (
    task_id IN (
      SELECT t.id FROM tasks t
      JOIN projects p ON t.project_id = p.id
      WHERE p.client_id = auth.uid()
    )
  );

CREATE POLICY "Clients can update proposals for their tasks"
  ON proposals
  FOR UPDATE
  TO authenticated
  USING (
    task_id IN (
      SELECT t.id FROM tasks t
      JOIN projects p ON t.project_id = p.id
      WHERE p.client_id = auth.uid()
    )
  );

-- Invitations policies
CREATE POLICY "Clients can manage own invitations"
  ON invitations
  FOR ALL
  TO authenticated
  USING (client_id = auth.uid());

CREATE POLICY "Workers can view and respond to their invitations"
  ON invitations
  FOR ALL
  TO authenticated
  USING (worker_id = auth.uid());

-- Favorites policies
CREATE POLICY "Users can manage own favorites"
  ON favorites
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid());

-- Task applications policies
CREATE POLICY "Workers can manage own applications"
  ON task_applications
  FOR ALL
  TO authenticated
  USING (worker_id = auth.uid());

CREATE POLICY "Clients can view applications for their tasks"
  ON task_applications
  FOR SELECT
  TO authenticated
  USING (
    task_id IN (
      SELECT t.id FROM tasks t
      JOIN projects p ON t.project_id = p.id
      WHERE p.client_id = auth.uid()
    )
  );

-- Functions for task matching algorithm
CREATE OR REPLACE FUNCTION calculate_worker_score(
  worker_skills text[],
  required_skills text[],
  worker_rating numeric
) RETURNS numeric AS $$
DECLARE
  matched_skills integer := 0;
  total_required integer := array_length(required_skills, 1);
  skill_match_ratio numeric;
BEGIN
  -- Count matching skills
  SELECT COUNT(*)
  INTO matched_skills
  FROM unnest(worker_skills) AS ws
  WHERE ws = ANY(required_skills);
  
  -- Calculate skill match ratio
  IF total_required = 0 THEN
    skill_match_ratio := 1.0;
  ELSE
    skill_match_ratio := matched_skills::numeric / total_required::numeric;
  END IF;
  
  -- Return final score
  RETURN skill_match_ratio * worker_rating;
END;
$$ LANGUAGE plpgsql;

-- Function to auto-assign tasks
CREATE OR REPLACE FUNCTION auto_assign_task(task_id uuid)
RETURNS uuid AS $$
DECLARE
  best_worker_id uuid;
  best_score numeric := 0;
  current_score numeric;
  task_record record;
  worker_record record;
BEGIN
  -- Get task details
  SELECT * INTO task_record
  FROM tasks
  WHERE id = task_id AND status = 'open';
  
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;
  
  -- Find best matching worker from applications
  FOR worker_record IN
    SELECT u.*, ta.applied_at
    FROM users u
    JOIN task_applications ta ON u.id = ta.worker_id
    WHERE ta.task_id = task_id
    ORDER BY ta.applied_at ASC
  LOOP
    current_score := calculate_worker_score(
      worker_record.skills,
      task_record.required_skills,
      worker_record.rating
    );
    
    IF current_score > best_score THEN
      best_score := current_score;
      best_worker_id := worker_record.id;
    END IF;
  END LOOP;
  
  -- Assign task to best worker
  IF best_worker_id IS NOT NULL THEN
    UPDATE tasks
    SET assignee_id = best_worker_id, status = 'assigned'
    WHERE id = task_id;
    
    -- Create notification
    INSERT INTO notifications (user_id, title, message, type)
    VALUES (
      best_worker_id,
      'Task Assigned',
      'You have been assigned to task: ' || task_record.title,
      'success'
    );
  END IF;
  
  RETURN best_worker_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Triggers for updated_at
CREATE TRIGGER update_chat_channels_updated_at
  BEFORE UPDATE ON chat_channels
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_proposals_updated_at
  BEFORE UPDATE ON proposals
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_invitations_updated_at
  BEFORE UPDATE ON invitations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();