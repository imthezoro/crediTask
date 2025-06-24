/*
  # Chat System Enhancement

  1. New Tables
    - `chat_rooms` - Direct and group chat containers
    - `chat_participants` - Users in each chat room

  2. Enhanced Tables
    - Keep existing `chat_channels` for project-based chats
    - Keep existing `chat_messages` but add compatibility

  3. Functions
    - Direct chat creation between users
    - Project group chat management
    - Automatic chat creation on task assignment

  4. Security
    - RLS policies for new tables
    - Secure functions with proper permissions
*/

-- 1. CREATE NEW TABLES (avoiding conflicts with existing chat_channels/chat_messages)

-- Chat rooms table for direct and group chats
CREATE TABLE IF NOT EXISTS chat_rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  is_group boolean NOT NULL DEFAULT false,
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE,
  name text,
  created_at timestamptz DEFAULT now()
);

-- Chat participants table
CREATE TABLE IF NOT EXISTS chat_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_room_id uuid NOT NULL REFERENCES chat_rooms(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  joined_at timestamptz DEFAULT now(),
  UNIQUE(chat_room_id, user_id)
);

-- Chat room messages (separate from existing chat_messages which is for chat_channels)
CREATE TABLE IF NOT EXISTS chat_room_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_room_id uuid NOT NULL REFERENCES chat_rooms(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content text NOT NULL,
  message_type text DEFAULT 'text' CHECK (message_type IN ('text', 'file', 'system')),
  file_url text,
  created_at timestamptz DEFAULT now()
);

-- 2. ENABLE ROW-LEVEL SECURITY

ALTER TABLE chat_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_room_messages ENABLE ROW LEVEL SECURITY;

-- 3. CREATE POLICIES

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
    -- Allow if user is joining themselves to a chat they have access to
    user_id = auth.uid() OR
    -- Allow if user is adding someone to a project chat they own
    chat_room_id IN (
      SELECT cr.id FROM chat_rooms cr
      JOIN projects p ON cr.project_id = p.id
      WHERE p.client_id = auth.uid()
    )
  );

-- Chat room messages policies
CREATE POLICY "Users can view messages in their chat rooms"
  ON chat_room_messages
  FOR SELECT
  TO authenticated
  USING (
    chat_room_id IN (
      SELECT chat_room_id FROM chat_participants WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can send messages to their chat rooms"
  ON chat_room_messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    sender_id = auth.uid() AND
    chat_room_id IN (
      SELECT chat_room_id FROM chat_participants WHERE user_id = auth.uid()
    )
  );

-- 4. CREATE FUNCTIONS AND TRIGGERS

-- Function to create or get existing direct chat between two users
CREATE OR REPLACE FUNCTION create_or_get_direct_chat(user1_id uuid, user2_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  room_id uuid;
  existing_room_id uuid;
BEGIN
  -- Ensure user1_id and user2_id are different
  IF user1_id = user2_id THEN
    RAISE EXCEPTION 'Cannot create chat with self';
  END IF;

  -- Check if direct chat already exists between these users
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
  INSERT INTO chat_rooms (is_group, project_id, name)
  VALUES (false, NULL, 'Direct Chat')
  RETURNING id INTO room_id;

  -- Add both users as participants
  INSERT INTO chat_participants (chat_room_id, user_id)
  VALUES 
    (room_id, user1_id),
    (room_id, user2_id);

  RETURN room_id;
END;
$$;

-- Function to create group chat for a project
CREATE OR REPLACE FUNCTION create_project_group_chat(p_project_id uuid)
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
  -- Get project details
  SELECT * INTO project_record
  FROM projects
  WHERE id = p_project_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Project not found: %', p_project_id;
  END IF;

  -- Check if project group chat already exists
  SELECT id INTO existing_room_id
  FROM chat_rooms
  WHERE project_id = p_project_id AND is_group = true;

  IF existing_room_id IS NOT NULL THEN
    RETURN existing_room_id;
  END IF;

  -- Create new project group chat room
  INSERT INTO chat_rooms (is_group, project_id, name)
  VALUES (true, p_project_id, project_record.title || ' - Project Chat')
  RETURNING id INTO room_id;

  -- Add project client as participant
  INSERT INTO chat_participants (chat_room_id, user_id)
  VALUES (room_id, project_record.client_id);

  -- Add all currently assigned workers as participants
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

-- Function to add user to project group chat if not already a participant
CREATE OR REPLACE FUNCTION add_user_to_project_chat(p_project_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  room_id uuid;
  participant_exists boolean;
BEGIN
  -- Get project group chat room
  SELECT id INTO room_id
  FROM chat_rooms
  WHERE project_id = p_project_id AND is_group = true;

  IF room_id IS NULL THEN
    -- Create group chat if it doesn't exist
    room_id := create_project_group_chat(p_project_id);
    RETURN true;
  END IF;

  -- Check if user is already a participant
  SELECT EXISTS (
    SELECT 1 FROM chat_participants
    WHERE chat_room_id = room_id AND user_id = p_user_id
  ) INTO participant_exists;

  IF participant_exists THEN
    RETURN false; -- User already in chat
  END IF;

  -- Add user to group chat
  INSERT INTO chat_participants (chat_room_id, user_id)
  VALUES (room_id, p_user_id);

  RETURN true;
END;
$$;

-- Function to handle task assignment (creates direct chat and adds to group chat)
CREATE OR REPLACE FUNCTION handle_task_assignment(p_task_id uuid, p_assignee_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  task_record record;
  direct_chat_id uuid;
  welcome_message text;
BEGIN
  -- Get task and project details
  SELECT t.*, p.client_id, p.title as project_title
  INTO task_record
  FROM tasks t
  JOIN projects p ON t.project_id = p.id
  WHERE t.id = p_task_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Task not found: %', p_task_id;
  END IF;

  -- Create or get direct chat between client and assignee
  direct_chat_id := create_or_get_direct_chat(task_record.client_id, p_assignee_id);

  -- Insert welcome message in direct chat
  welcome_message := 'You''ve been connected for task: ' || task_record.title;
  INSERT INTO chat_room_messages (chat_room_id, sender_id, content, message_type)
  VALUES (direct_chat_id, task_record.client_id, welcome_message, 'system');

  -- Add assignee to project group chat
  PERFORM add_user_to_project_chat(task_record.project_id, p_assignee_id);
END;
$$;

-- Function to handle project creation (creates group chat)
CREATE OR REPLACE FUNCTION handle_project_creation(p_project_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  room_id uuid;
BEGIN
  -- Create project group chat
  room_id := create_project_group_chat(p_project_id);
  
  RETURN room_id;
END;
$$;

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
    PERFORM handle_task_assignment(NEW.id, NEW.assignee_id);
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
DROP TRIGGER IF EXISTS task_assignment_chat_trigger ON tasks;
CREATE TRIGGER task_assignment_chat_trigger
  AFTER UPDATE OF assignee_id ON tasks
  FOR EACH ROW
  EXECUTE FUNCTION trigger_task_assignment();

DROP TRIGGER IF EXISTS project_creation_chat_trigger ON projects;
CREATE TRIGGER project_creation_chat_trigger
  AFTER INSERT ON projects
  FOR EACH ROW
  EXECUTE FUNCTION trigger_project_creation();

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION create_or_get_direct_chat(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION create_project_group_chat(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION add_user_to_project_chat(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION handle_task_assignment(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION handle_project_creation(uuid) TO authenticated;