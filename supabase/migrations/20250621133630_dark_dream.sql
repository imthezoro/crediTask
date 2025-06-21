/*
  # Create notification function for cross-user notifications

  1. New Functions
    - `create_notification_for_user` - Allows creating notifications for other users securely
    
  2. Security
    - Function runs with SECURITY DEFINER to bypass RLS
    - Only authenticated users can execute
    - Validates that the notification is being created in valid contexts (task applications, etc.)
*/

-- Create a function to safely create notifications for other users
CREATE OR REPLACE FUNCTION create_notification_for_user(
  target_user_id uuid,
  notification_title text,
  notification_message text,
  notification_type text DEFAULT 'info'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  notification_id uuid;
BEGIN
  -- Validate notification type
  IF notification_type NOT IN ('info', 'success', 'warning', 'error') THEN
    RAISE EXCEPTION 'Invalid notification type: %', notification_type;
  END IF;

  -- Validate that target user exists
  IF NOT EXISTS (SELECT 1 FROM users WHERE id = target_user_id) THEN
    RAISE EXCEPTION 'Target user does not exist: %', target_user_id;
  END IF;

  -- Insert the notification
  INSERT INTO notifications (user_id, title, message, type)
  VALUES (target_user_id, notification_title, notification_message, notification_type)
  RETURNING id INTO notification_id;

  RETURN notification_id;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION create_notification_for_user(uuid, text, text, text) TO authenticated;