ALTER TABLE tasks ADD COLUMN success_criteria varchar DEFAULT '';
ALTER TABLE tasks ADD COLUMN detailed_tasks varchar DEFAULT '';
ALTER TABLE tasks ADD COLUMN priority integer DEFAULT 0;
ALTER TABLE tasks ADD COLUMN budget integer DEFAULT 0;


CREATE POLICY "Workers can claim open tasks"
  ON tasks
  FOR UPDATE
  TO authenticated
  USING (status = 'open' AND assignee_id IS NULL)
  WITH CHECK (assignee_id = auth.uid() AND status = 'assigned');


CREATE POLICY "Allow select id and name for chat participants" ON public.users
               FOR SELECT
             USING (
             EXISTS (
                  SELECT 1 FROM chat_participants
                 WHERE chat_participants.user_id = users.id
               )
             );



CREATE POLICY "Workers can claim open tasks"
  ON users;

drop policy "Workers can claim open tasks"
on users;
