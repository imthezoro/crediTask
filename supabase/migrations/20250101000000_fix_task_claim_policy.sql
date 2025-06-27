-- Allow workers to claim open tasks by updating assignee_id and status
CREATE POLICY "Workers can claim open tasks"
  ON tasks
  FOR UPDATE
  TO authenticated
  USING (status = 'open' AND assignee_id IS NULL)
  WITH CHECK (assignee_id = auth.uid() AND status = 'assigned');