-- 1. Create the SECURITY DEFINER function
CREATE OR REPLACE FUNCTION is_user_in_chat_room(room_id uuid, check_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM chat_participants
    WHERE chat_room_id = room_id AND user_id = check_user_id
  );
$$;

-- 2. Grant execute permission
GRANT EXECUTE ON FUNCTION is_user_in_chat_room(uuid, uuid) TO authenticated;

-- 3. Replace your policy
DROP POLICY IF EXISTS "Users can view participants in their chats" ON chat_participants;
CREATE POLICY "Users can view participants in their chats" ON chat_participants
  FOR SELECT TO authenticated
  USING (is_user_in_chat_room(chat_room_id));