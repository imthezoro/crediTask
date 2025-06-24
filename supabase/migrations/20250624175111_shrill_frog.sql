-- Fixed function to create a group chat for a project
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

  -- Add all assigned workers as participants without duplicates
  INSERT INTO chat_participants (chat_room_id, user_id)
  SELECT room_id, sub.assignee_id
  FROM (
    SELECT DISTINCT assignee_id
    FROM tasks
    WHERE project_id = p_project_id
      AND assignee_id IS NOT NULL
      AND assignee_id != project_record.client_id
  ) AS sub;

  RETURN room_id;
END;
$$;