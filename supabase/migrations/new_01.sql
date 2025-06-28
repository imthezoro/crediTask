/*
  # Fix Chat Trigger for Task Assignment

  Update the trigger_task_assignment function to also create chat connections
  when a worker's application is approved and they are assigned to a task.

  This ensures that:
  1. When a client approves a worker's application
  2. The task gets assigned to the worker (assignee_id is updated)
  3. The trigger fires and creates chat connections
  4. Both client and worker can see each other in chat
*/

-- Update the trigger function to also create chat connections
CREATE OR REPLACE FUNCTION trigger_task_assignment()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Only proceed if assignee_id actually changed and is not null
  IF OLD.assignee_id IS DISTINCT FROM NEW.assignee_id AND NEW.assignee_id IS NOT NULL THEN
    -- Create notification for assigned worker
    INSERT INTO notifications (user_id, title, message, type)
    VALUES (
      NEW.assignee_id,
      'Task Assigned',
      'You have been assigned to task: ' || NEW.title,
      'info'
    );

    -- Create chat connections between client and worker
    PERFORM handle_task_assignment(NEW.id);
  END IF;
  
  RETURN NEW;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION trigger_task_assignment() TO authenticated;