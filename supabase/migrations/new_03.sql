
  DROP POLICY IF EXISTS "Users can view participants in their chats" ON "public"."chat_participants";

CREATE POLICY "Users can view participants in their chats" ON "public"."chat_participants"
  FOR SELECT TO "authenticated"
  USING (
    chat_room_id IN (
      SELECT chat_room_id FROM chat_participants
      WHERE user_id = auth.uid()
    )
  );
  