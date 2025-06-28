-- Fix RLS policy for chat_participants to avoid infinite recursion

DROP POLICY IF EXISTS "Users can view participants in their chats" ON "public"."chat_participants";

CREATE POLICY "Users can view participants in their chats" ON "public"."chat_participants"
  FOR SELECT TO "authenticated"
  USING (
    EXISTS (
      SELECT 1 FROM chat_participants AS cp
      WHERE cp.chat_room_id = chat_participants.chat_room_id
        AND cp.user_id = auth.uid()
    )
  );