/*
  # Complete Chat System Reset and Recreation
  
  This migration completely resets and recreates the chat system with proper ordering
  to avoid dependency conflicts and ensure clean installation.
*/

-- ============================================================================
-- 🔴 STEP 1: COMPLETE CLEANUP (DROP ALL EXISTING OBJECTS)
-- ============================================================================

-- Drop triggers first (they depend on functions)
DROP TRIGGER IF EXISTS task_assignment_chat_trigger ON tasks;
DROP TRIGGER IF EXISTS project_creation_chat_trigger ON projects;
DROP TRIGGER IF EXISTS task_assignment_trigger ON tasks;
DROP TRIGGER IF EXISTS project_creation_trigger ON projects;

-- Drop all chat-related functions
DROP FUNCTION IF EXISTS create_direct_chat(uuid, uuid) CASCADE;
DROP FUNCTION IF EXISTS create_project_chat(uuid, uuid) CASCADE;
DROP FUNCTION IF EXISTS add_user_to_chat(uuid, uuid) CASCADE;
DROP FUNCTION IF EXISTS handle_task_assignment(uuid, uuid) CASCADE;
DROP FUNCTION IF EXISTS handle_project_creation(uuid) CASCADE;
DROP FUNCTION IF EXISTS create_or_get_direct_chat(uuid, uuid) CASCADE;
DROP FUNCTION IF EXISTS create_project_group_chat(uuid) CASCADE;
DROP FUNCTION IF EXISTS add_user_to_project_chat(uuid, uuid) CASCADE;
DROP FUNCTION IF EXISTS handle_task_assignment_chat(uuid, uuid) CASCADE;
DROP FUNCTION IF EXISTS handle_project_creation_chat(uuid) CASCADE;
DROP FUNCTION IF EXISTS trigger_task_assignment() CASCADE;
DROP FUNCTION IF EXISTS trigger_project_creation() CASCADE;
DROP FUNCTION IF EXISTS trigger_task_assignment_chat() CASCADE;
DROP FUNCTION IF EXISTS trigger_project_creation_chat() CASCADE;

-- Drop all chat tables (in reverse dependency order)
DROP TABLE IF EXISTS chat_messages CASCADE;
DROP TABLE IF EXISTS chat_room_messages CASCADE;
DROP TABLE IF EXISTS chat_participants CASCADE;
DROP TABLE IF EXISTS chat_rooms CASCADE;

-- ============================================================================
-- ✅ STEP 2: CREATE TABLES IN PROPER ORDER
-- ============================================================================

-- 1. Chat rooms table
CREATE TABLE chat_rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  is_group boolean NOT NULL DEFAULT false,
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);

-- 2. Chat participants table
CREATE TABLE chat_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_room_id uuid NOT NULL REFERENCES chat_rooms(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  joined_at timestamptz DEFAULT now(),
  UNIQUE(chat_room_id, user_id)
);

-- 3. Chat messages table
CREATE TABLE chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_room_id uuid NOT NULL REFERENCES chat_rooms(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message text NOT NULL,
  sent_at timestamptz DEFAULT now()
);

-- ============================================================================
-- 🔐 STEP 3: ENABLE RLS AND CREATE POLICIES
-- ============================================================================

-- Enable Row Level Security
ALTER TABLE chat_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- Chat rooms policies
CREATE POLICY "Users can view their chat rooms"
  ON chat_rooms
  FOR SELECT
  TO authenticated
  USING (
    id IN (
      SELECT chat_room_id FROM chat_participants WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create chat rooms"
  ON chat_rooms
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Chat participants policies
CREATE POLICY "Users can view participants in their chats"
  ON chat_participants
  FOR SELECT
  TO authenticated
  USING (
    chat_room_id IN (
      SELECT chat_room_id FROM chat_participants WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can join chats they have access to"
  ON chat_participants
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid() OR
    chat_room_id IN (
      SELECT cr.id FROM chat_rooms cr
      JOIN projects p ON cr.project_id = p.id
      WHERE p.client_id = auth.uid()
    )
  );

-- Chat messages policies
CREATE POLICY "Users can view messages in their chat rooms"
  ON chat_messages
  FOR SELECT
  TO authenticated
  USING (
    chat_room_id IN (
      SELECT chat_room_id FROM chat_participants WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can send messages to their chat rooms"
  ON chat_messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    sender_id = auth.uid() AND
    chat_room_id IN (
      SELECT chat_room_id FROM chat_participants WHERE user_id = auth.uid()
    )
  );

-- ============================================================================
-- 🛠️ STEP 4: CREATE FUNCTIONS
-- ============================================================================

-- Function to create direct chat between two users
CREATE OR REPLACE FUNCTION create_direct_chat(user1_id uuid, user2_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  room_id uuid;
  existing_room_id uuid;
BEGIN
  -- Validate input
  IF user1_id = user2_id THEN
    RAISE EXCEPTION 'Cannot create chat with self';
  END IF;

  -- Check if direct chat already exists
  SELECT cr.id INTO existing_room_id
  FROM chat_rooms cr
  WHERE cr.is_group = false
    AND cr.project_id IS NULL
    AND EXISTS (
      SELECT 1 FROM chat_participants cp1 
      WHERE cp1.chat_room_id = cr.id AND cp1.user_id = user1_id
    )
    AND EXISTS (
      SELECT 1 FROM chat_participants cp2 
      WHERE cp2.chat_room_id = cr.id AND cp2.user_id = user2_id
    )
    AND (
      SELECT COUNT(*) FROM chat_participants cp 
      WHERE cp.chat_room_id = cr.id
    ) = 2;

  IF existing_room_id IS NOT NULL THEN
    RETURN existing_room_id;
  END IF;

  -- Create new direct chat room
  INSERT INTO chat_rooms (is_group, project_id)
  VALUES (false, NULL)
  RETURNING id INTO room_id;

  -- Add both users as participants
  INSERT INTO chat_participants (chat_room_id, user_id)
  VALUES 
    (room_id, user1_id),
    (room_id, user2_id);

  RETURN room_id;
END;
$$;

-- Function to create project chat
CREATE OR REPLACE FUNCTION create_project_chat(p_project_id uuid, creator_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  room_id uuid;
  existing_room_id uuid;
  project_record record;
BEGIN
  -- Get project details and verify access
  SELECT * INTO project_record
  FROM projects
  WHERE id = p_project_id
    AND (client_id = creator_id OR id IN (
      SELECT DISTINCT t.project_id
      FROM tasks t
      WHERE t.assignee_id = creator_id
    ));

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Project not found or access denied';
  END IF;

  -- Check if project chat already exists
  SELECT id INTO existing_room_id
  FROM chat_rooms
  WHERE project_id = p_project_id AND is_group = true;

  IF existing_room_id IS NOT NULL THEN
    RETURN existing_room_id;
  END IF;

  -- Create new project chat room
  INSERT INTO chat_rooms (is_group, project_id)
  VALUES (true, p_project_id)
  RETURNING id INTO room_id;

  -- Add project client as participant
  INSERT INTO chat_participants (chat_room_id, user_id)
  VALUES (room_id, project_record.client_id);

  -- Add all assigned workers as participants
  INSERT INTO chat_participants (chat_room_id, user_id)
  SELECT room_id, sub.assignee_id
  FROM (
    SELECT DISTINCT assignee_id
    FROM tasks
    WHERE project_id = p_project_id
      AND assignee_id IS NOT NULL
      AND assignee_id != project_record.client_id
  ) AS sub
  ON CONFLICT (chat_room_id, user_id) DO NOTHING;

  RETURN room_id;
END;
$$;

-- Function to add user to chat room
CREATE OR REPLACE FUNCTION add_user_to_chat(room_id uuid, new_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  room_record record;
  participant_exists boolean;
BEGIN
  -- Get room details
  SELECT * INTO room_record
  FROM chat_rooms
  WHERE id = room_id;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  -- For direct chats, don't allow adding more users
  IF room_record.is_group = false THEN
    RETURN false;
  END IF;

  -- Check if user is already a participant
  SELECT EXISTS (
    SELECT 1 FROM chat_participants
    WHERE chat_room_id = room_id AND user_id = new_user_id
  ) INTO participant_exists;

  IF participant_exists THEN
    RETURN false;
  END IF;

  -- Add user as participant
  INSERT INTO chat_participants (chat_room_id, user_id)
  VALUES (room_id, new_user_id);

  RETURN true;
END;
$$;

-- Function to handle task assignment
CREATE OR REPLACE FUNCTION handle_task_assignment(task_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  task_record record;
  direct_chat_id uuid;
  project_chat_id uuid;
  welcome_message text;
BEGIN
  -- Get task and project details
  SELECT t.*, p.client_id, p.title as project_title
  INTO task_record
  FROM tasks t
  JOIN projects p ON t.project_id = p.id
  WHERE t.id = task_id AND t.assignee_id IS NOT NULL;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  -- Create or get direct chat between client and assignee
  direct_chat_id := create_direct_chat(task_record.client_id, task_record.assignee_id);

  -- Insert welcome message
  welcome_message := 'You''ve been connected for task: ' || task_record.title;
  INSERT INTO chat_messages (chat_room_id, sender_id, message)
  VALUES (direct_chat_id, task_record.client_id, welcome_message);

  -- Create or get project group chat and add assignee
  project_chat_id := create_project_chat(task_record.project_id, task_record.client_id);
  PERFORM add_user_to_chat(project_chat_id, task_record.assignee_id);
END;
$$;

-- Function to handle project creation
CREATE OR REPLACE FUNCTION handle_project_creation(project_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  project_record record;
  room_id uuid;
BEGIN
  -- Get project details
  SELECT * INTO project_record
  FROM projects
  WHERE id = project_id;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  -- Create project group chat
  room_id := create_project_chat(project_id, project_record.client_id);
  
  RETURN room_id;
END;
$$;

-- ============================================================================
-- 🔄 STEP 5: CREATE TRIGGER FUNCTIONS AND TRIGGERS
-- ============================================================================

-- Trigger function for task assignment
CREATE OR REPLACE FUNCTION trigger_task_assignment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only trigger when assignee_id is being set (not when cleared)
  IF NEW.assignee_id IS NOT NULL AND (OLD.assignee_id IS NULL OR OLD.assignee_id != NEW.assignee_id) THEN
    PERFORM handle_task_assignment(NEW.id);
  END IF;
  
  RETURN NEW;
END;
$$;

-- Trigger function for project creation
CREATE OR REPLACE FUNCTION trigger_project_creation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Create group chat for new project
  PERFORM handle_project_creation(NEW.id);
  
  RETURN NEW;
END;
$$;

-- Create triggers
CREATE TRIGGER task_assignment_chat_trigger
  AFTER UPDATE OF assignee_id ON tasks
  FOR EACH ROW
  EXECUTE FUNCTION trigger_task_assignment();

CREATE TRIGGER project_creation_chat_trigger
  AFTER INSERT ON projects
  FOR EACH ROW
  EXECUTE FUNCTION trigger_project_creation();

-- ============================================================================
-- 🔑 STEP 6: GRANT PERMISSIONS
-- ============================================================================

GRANT EXECUTE ON FUNCTION create_direct_chat(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION create_project_chat(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION add_user_to_chat(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION handle_task_assignment(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION handle_project_creation(uuid) TO authenticated;

-- ============================================================================
-- 📊 STEP 7: CREATE PERFORMANCE INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_chat_participants_user_id ON chat_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_participants_chat_room_id ON chat_participants(chat_room_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_chat_room_id ON chat_messages(chat_room_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_sender_id ON chat_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_sent_at ON chat_messages(sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_rooms_project_id ON chat_rooms(project_id);
CREATE INDEX IF NOT EXISTS idx_chat_rooms_is_group ON chat_rooms(is_group);