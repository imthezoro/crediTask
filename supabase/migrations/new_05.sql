CREATE POLICY "Workers can view timers for tasks they've applied to"
  ON auto_assignment_timers
  FOR SELECT
  TO authenticated
  USING (
    task_id IN (
      SELECT ta.task_id FROM task_applications ta
      WHERE ta.worker_id = auth.uid()
    )
  );