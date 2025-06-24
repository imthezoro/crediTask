/*
  # Chat System Tables

  1. New Tables
    - `chat_rooms` - Chat rooms that can be direct or group chats
    - `chat_participants` - Users participating in chat rooms
    - `chat_messages` - Messages sent in chat rooms

  2. Security
    - Enable RLS on all tables
    - Add policies for secure access control
    - Users can only access chats they participate in

  3. Relationships
    - Chat rooms can be linked to projects for group chats
    - Participants link users to chat rooms
    - Messages are sent by users in specific chat rooms
*/

-- Chat rooms table
CREATE TABLE IF NOT EXISTS chat_rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  is_group boolean NOT NULL DEFAULT false,
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE,
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

-- Chat messages table
CREATE TABLE IF NOT EXISTS chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_room_id uuid NOT NULL REFERENCES chat_rooms(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message text NOT NULL,
  sent_at timestamptz DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE chat_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- Chat rooms policies
CREATE POLICY "Users can view chat rooms they participate in"
  ON chat_rooms
  FOR SELECT
  TO authenticated
  USING (
    id IN (
      SELECT chat_room_id 
      FROM chat_participants 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create chat rooms"
  ON chat_rooms
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update chat rooms they participate in"
  ON chat_rooms
  FOR UPDATE
  TO authenticated
  USING (
    id IN (
      SELECT chat_room_id 
      FROM chat_participants 
      WHERE user_id = auth.uid()
    )
  );

-- Chat participants policies
CREATE POLICY "Users can view participants in their chat rooms"
  ON chat_participants
  FOR SELECT
  TO authenticated
  USING (
    chat_room_id IN (
      SELECT chat_room_id 
      FROM chat_participants 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can add participants to chat rooms they're in"
  ON chat_participants
  FOR INSERT
  TO authenticated
  WITH CHECK (
    chat_room_id IN (
      SELECT chat_room_id 
      FROM chat_participants 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can remove themselves from chat rooms"
  ON chat_participants
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- Chat messages policies
CREATE POLICY "Users can view messages in their chat rooms"
  ON chat_messages
  FOR SELECT
  TO authenticated
  USING (
    chat_room_id IN (
      SELECT chat_room_id 
      FROM chat_participants 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can send messages to their chat rooms"
  ON chat_messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    sender_id = auth.uid() AND
    chat_room_id IN (
      SELECT chat_room_id 
      FROM chat_participants 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their own messages"
  ON chat_messages
  FOR UPDATE
  TO authenticated
  USING (sender_id = auth.uid())
  WITH CHECK (sender_id = auth.uid());

CREATE POLICY "Users can delete their own messages"
  ON chat_messages
  FOR DELETE
  TO authenticated
  USING (sender_id = auth.uid());

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_chat_participants_user_id ON chat_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_participants_chat_room_id ON chat_participants(chat_room_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_chat_room_id ON chat_messages(chat_room_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_sender_id ON chat_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_sent_at ON chat_messages(sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_rooms_project_id ON chat_rooms(project_id);

-- Function to create a direct chat room between two users
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
  -- Check if a direct chat already exists between these users
  SELECT cr.id INTO existing_room_id
  FROM chat_rooms cr
  WHERE cr.is_group = false
    AND cr.id IN (
      SELECT cp1.chat_room_id
      FROM chat_participants cp1
      WHERE cp1.user_id = user1_id
    )
    AND cr.id IN (
      SELECT cp2.chat_room_id
      FROM chat_participants cp2
      WHERE cp2.user_id = user2_id
    )
    AND (
      SELECT COUNT(*)
      FROM chat_participants cp
      WHERE cp.chat_room_id = cr.id
    ) = 2;

  -- If room exists, return it
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

-- Function to create a group chat for a project
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
  -- Verify project exists and user has access
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
  SELECT room_id, DISTINCT t.assignee_id
  FROM tasks t
  WHERE t.project_id = p_project_id
    AND t.assignee_id IS NOT NULL
    AND t.assignee_id != project_record.client_id;

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

  -- Add user as participant (ignore if already exists)
  INSERT INTO chat_participants (chat_room_id, user_id)
  VALUES (room_id, new_user_id)
  ON CONFLICT (chat_room_id, user_id) DO NOTHING;

  RETURN true;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION create_direct_chat(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION create_project_chat(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION add_user_to_chat(uuid, uuid) TO authenticated;