

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE OR REPLACE FUNCTION "public"."add_user_to_chat"("room_id" "uuid", "new_user_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  room_record record;
  participant_exists boolean;
BEGIN
  -- Validate input
  IF room_id IS NULL OR new_user_id IS NULL THEN
    RETURN false;
  END IF;

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

  -- Check if user is already a participant
  SELECT EXISTS (
    SELECT 1 FROM chat_participants
    WHERE chat_room_id = room_id AND user_id = new_user_id
  ) INTO participant_exists;

  IF participant_exists THEN
    RETURN false;
  END IF;

  -- Add user as participant
  INSERT INTO chat_participants (chat_room_id, user_id)
  VALUES (room_id, new_user_id);

  RETURN true;
END;
$$;


ALTER FUNCTION "public"."add_user_to_chat"("room_id" "uuid", "new_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."auto_assign_task"("task_id" "uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  best_worker_id uuid;
  best_score numeric := 0;
  current_score numeric;
  task_record record;
  worker_record record;
BEGIN
  -- Get task details
  SELECT * INTO task_record
  FROM tasks
  WHERE id = task_id AND status = 'open';
  
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;
  
  -- Find best matching worker from applications
  FOR worker_record IN
    SELECT u.*, ta.applied_at
    FROM users u
    JOIN task_applications ta ON u.id = ta.worker_id
    WHERE ta.task_id = task_id
    ORDER BY ta.applied_at ASC
  LOOP
    current_score := calculate_worker_score(
      worker_record.skills,
      task_record.required_skills,
      worker_record.rating
    );
    
    IF current_score > best_score THEN
      best_score := current_score;
      best_worker_id := worker_record.id;
    END IF;
  END LOOP;
  
  -- Assign task to best worker
  IF best_worker_id IS NOT NULL THEN
    UPDATE tasks
    SET assignee_id = best_worker_id, status = 'assigned'
    WHERE id = task_id;
    
    -- Create notification
    INSERT INTO notifications (user_id, title, message, type)
    VALUES (
      best_worker_id,
      'Task Assigned',
      'You have been assigned to task: ' || task_record.title,
      'success'
    );
  END IF;
  
  RETURN best_worker_id;
END;
$$;


ALTER FUNCTION "public"."auto_assign_task"("task_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."calculate_application_score"("worker_skills" "text"[], "required_skills" "text"[], "worker_rating" numeric, "application_time" timestamp with time zone) RETURNS TABLE("skill_score" numeric, "rating_score" numeric, "time_bonus" numeric, "total_score" numeric)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  matched_skills integer := 0;
  total_required integer;
  skill_match_ratio numeric;
  time_bonus_val numeric := 0;
BEGIN
  -- Count matching skills
  SELECT COUNT(*)
  INTO matched_skills
  FROM unnest(worker_skills) AS ws
  WHERE ws = ANY(required_skills);
  
  -- Get total required skills
  total_required := array_length(required_skills, 1);
  
  -- Calculate skill match ratio
  IF total_required = 0 OR total_required IS NULL THEN
    skill_match_ratio := 1.0;
  ELSE
    skill_match_ratio := matched_skills::numeric / total_required::numeric;
  END IF;
  
  -- Calculate time bonus (earlier applications get slight bonus)
  time_bonus_val := GREATEST(0, 1.0 - EXTRACT(EPOCH FROM (now() - application_time)) / 86400.0) * 0.1;
  
  RETURN QUERY SELECT
    skill_match_ratio as skill_score,
    COALESCE(worker_rating, 0) as rating_score,
    time_bonus_val as time_bonus,
    (skill_match_ratio * COALESCE(worker_rating, 0)) + time_bonus_val as total_score;
END;
$$;


ALTER FUNCTION "public"."calculate_application_score"("worker_skills" "text"[], "required_skills" "text"[], "worker_rating" numeric, "application_time" timestamp with time zone) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."calculate_worker_score"("worker_skills" "text"[], "required_skills" "text"[], "worker_rating" numeric) RETURNS numeric
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  matched_skills integer := 0;
  total_required integer := array_length(required_skills, 1);
  skill_match_ratio numeric;
BEGIN
  -- Count matching skills
  SELECT COUNT(*)
  INTO matched_skills
  FROM unnest(worker_skills) AS ws
  WHERE ws = ANY(required_skills);
  
  -- Calculate skill match ratio
  IF total_required = 0 THEN
    skill_match_ratio := 1.0;
  ELSE
    skill_match_ratio := matched_skills::numeric / total_required::numeric;
  END IF;
  
  -- Return final score
  RETURN skill_match_ratio * worker_rating;
END;
$$;


ALTER FUNCTION "public"."calculate_worker_score"("worker_skills" "text"[], "required_skills" "text"[], "worker_rating" numeric) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_direct_chat"("user1_id" "uuid", "user2_id" "uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  room_id uuid;
  existing_room_id uuid;
BEGIN
  -- Validate input
  IF user1_id IS NULL OR user2_id IS NULL THEN
    RAISE EXCEPTION 'User IDs cannot be null';
  END IF;
  
  IF user1_id = user2_id THEN
    RAISE EXCEPTION 'Cannot create chat with self';
  END IF;

  -- Check if direct chat already exists between these users
  SELECT cr.id INTO existing_room_id
  FROM chat_rooms cr
  WHERE cr.is_group = false
    AND cr.project_id IS NULL
    AND EXISTS (
      SELECT 1 FROM chat_participants cp1 
      WHERE cp1.chat_room_id = cr.id AND cp1.user_id = user1_id
    )
    AND EXISTS (
      SELECT 1 FROM chat_participants cp2 
      WHERE cp2.chat_room_id = cr.id AND cp2.user_id = user2_id
    )
    AND (
      SELECT COUNT(*) FROM chat_participants cp 
      WHERE cp.chat_room_id = cr.id
    ) = 2;

  -- Return existing room if found
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


ALTER FUNCTION "public"."create_direct_chat"("user1_id" "uuid", "user2_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_notification_for_user"("target_user_id" "uuid", "notification_title" "text", "notification_message" "text", "notification_type" "text" DEFAULT 'info'::"text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  INSERT INTO notifications (user_id, title, message, type)
  VALUES (target_user_id, notification_title, notification_message, notification_type);
END;
$$;


ALTER FUNCTION "public"."create_notification_for_user"("target_user_id" "uuid", "notification_title" "text", "notification_message" "text", "notification_type" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_project_chat"("p_project_id" "uuid", "creator_id" "uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  room_id uuid;
  existing_room_id uuid;
  project_record record;
BEGIN
  -- Validate input
  IF p_project_id IS NULL OR creator_id IS NULL THEN
    RAISE EXCEPTION 'Project ID and creator ID cannot be null';
  END IF;

  -- Get project details and verify access
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

  -- Return existing room if found
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

  -- Add all assigned workers as participants (avoid duplicates)
  INSERT INTO chat_participants (chat_room_id, user_id)
  SELECT room_id, sub.assignee_id
  FROM (
    SELECT DISTINCT assignee_id
    FROM tasks
    WHERE project_id = p_project_id
      AND assignee_id IS NOT NULL
      AND assignee_id != project_record.client_id
  ) AS sub
  ON CONFLICT (chat_room_id, user_id) DO NOTHING;

  RETURN room_id;
END;
$$;


ALTER FUNCTION "public"."create_project_chat"("p_project_id" "uuid", "creator_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."evaluate_auto_assignment"("p_task_id" "uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  task_record record;
  best_worker_id uuid;
  best_score numeric := -1;
  application_record record;
  score_result record;
  assignment_count integer;
BEGIN
  -- Get task details
  SELECT t.*, p.client_id INTO task_record
  FROM tasks t
  JOIN projects p ON t.project_id = p.id
  WHERE t.id = p_task_id 
    AND t.status = 'open' 
    AND t.auto_assign = true;
  
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;
  
  -- Count applications for this task
  SELECT COUNT(*) INTO assignment_count
  FROM task_applications ta
  WHERE ta.task_id = p_task_id;
  
  -- If no applications, return null
  IF assignment_count = 0 THEN
    RETURN NULL;
  END IF;
  
  -- If only one application, assign directly
  IF assignment_count = 1 THEN
    SELECT ta.worker_id INTO best_worker_id
    FROM task_applications ta
    WHERE ta.task_id = p_task_id;
  ELSE
    -- Evaluate all applications and find best candidate
    FOR application_record IN
      SELECT ta.*, u.skills, u.rating
      FROM task_applications ta
      JOIN users u ON ta.worker_id = u.id
      WHERE ta.task_id = p_task_id
      ORDER BY ta.applied_at ASC
    LOOP
      -- Calculate score for this application
      SELECT * INTO score_result
      FROM calculate_application_score(
        application_record.skills,
        task_record.required_skills,
        application_record.rating,
        application_record.applied_at
      );
      
      -- Update best candidate if this score is higher
      IF score_result.total_score > best_score THEN
        best_score := score_result.total_score;
        best_worker_id := application_record.worker_id;
      END IF;
    END LOOP;
  END IF;
  
  -- Assign task to best worker
  IF best_worker_id IS NOT NULL THEN
    -- Update task
    UPDATE tasks
    SET assignee_id = best_worker_id, status = 'assigned'
    WHERE id = p_task_id;
    
    -- Mark selected application
    UPDATE task_applications
    SET selected = true
    WHERE task_id = p_task_id AND worker_id = best_worker_id;
    
    -- Mark other applications as not selected
    UPDATE task_applications
    SET selected = false
    WHERE task_id = p_task_id AND worker_id != best_worker_id;
    
    -- Update application bucket status
    UPDATE application_buckets
    SET status = 'closed'
    WHERE task_id = p_task_id;
    
    -- Mark auto-assignment timer as completed
    UPDATE auto_assignment_timers
    SET status = 'completed'
    WHERE task_id = p_task_id;
    
    -- Create notification for selected worker
    INSERT INTO notifications (user_id, title, message, type)
    VALUES (
      best_worker_id,
      'Task Auto-Assigned',
      'You have been automatically assigned to task: ' || task_record.title,
      'success'
    );
    
    -- Create notifications for non-selected workers
    INSERT INTO notifications (user_id, title, message, type)
    SELECT 
      ta.worker_id,
      'Application Not Selected',
      'Your application for "' || task_record.title || '" was not selected.',
      'info'
    FROM task_applications ta
    WHERE ta.task_id = p_task_id AND ta.worker_id != best_worker_id;
  END IF;
  
  RETURN best_worker_id;
END;
$$;


ALTER FUNCTION "public"."evaluate_auto_assignment"("p_task_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."extend_auto_assignment_timer"("p_task_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  timer_record record;
  new_window_end timestamptz;
BEGIN
  -- Get current timer
  SELECT * INTO timer_record
  FROM auto_assignment_timers
  WHERE task_id = p_task_id AND status = 'active';
  
  IF NOT FOUND THEN
    RETURN false;
  END IF;
  
  -- Check if we can extend (max extensions limit)
  IF timer_record.extensions_count >= timer_record.max_extensions THEN
    RETURN false;
  END IF;
  
  -- Calculate new window end
  new_window_end := timer_record.window_end + (timer_record.application_window_minutes || ' minutes')::interval;
  
  -- Update timer
  UPDATE auto_assignment_timers
  SET 
    window_end = new_window_end,
    extensions_count = extensions_count + 1,
    updated_at = now()
  WHERE id = timer_record.id;
  
  RETURN true;
END;
$$;


ALTER FUNCTION "public"."extend_auto_assignment_timer"("p_task_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_or_create_application_bucket"("p_task_id" "uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  bucket_id uuid;
  task_record record;
BEGIN
  -- Get task and project info
  SELECT t.*, p.client_id INTO task_record
  FROM tasks t
  JOIN projects p ON t.project_id = p.id
  WHERE t.id = p_task_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Task not found: %', p_task_id;
  END IF;
  
  -- Check if bucket already exists
  SELECT id INTO bucket_id
  FROM application_buckets
  WHERE task_id = p_task_id;
  
  -- Create bucket if it doesn't exist
  IF bucket_id IS NULL THEN
    INSERT INTO application_buckets (project_id, task_id, client_id)
    VALUES (task_record.project_id, p_task_id, task_record.client_id)
    RETURNING id INTO bucket_id;
  END IF;
  
  RETURN bucket_id;
END;
$$;


ALTER FUNCTION "public"."get_or_create_application_bucket"("p_task_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_project_stats"("client_id" "uuid") RETURNS TABLE("total_projects" bigint, "active_projects" bigint, "completed_projects" bigint, "total_spent" numeric, "tasks_completed" bigint)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*) as total_projects,
    COUNT(*) FILTER (WHERE status IN ('open', 'in_progress')) as active_projects,
    COUNT(*) FILTER (WHERE status = 'completed') as completed_projects,
    COALESCE(SUM(budget), 0) as total_spent,
    (
      SELECT COUNT(*) 
      FROM tasks t 
      JOIN projects p ON t.project_id = p.id 
      WHERE p.client_id = get_project_stats.client_id 
      AND t.status = 'approved'
    ) as tasks_completed
  FROM projects 
  WHERE projects.client_id = get_project_stats.client_id;
END;
$$;


ALTER FUNCTION "public"."get_project_stats"("client_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_activity"("user_id" "uuid") RETURNS TABLE("tasks_completed" bigint, "tasks_pending" bigint, "tasks_rejected" bigint, "total_earnings" numeric)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*) FILTER (WHERE status = 'approved') as tasks_completed,
    COUNT(*) FILTER (WHERE status IN ('assigned', 'submitted')) as tasks_pending,
    COUNT(*) FILTER (WHERE status = 'rejected') as tasks_rejected,
    COALESCE(SUM(payout) FILTER (WHERE status = 'approved'), 0) as total_earnings
  FROM tasks 
  WHERE assignee_id = get_user_activity.user_id;
END;
$$;


ALTER FUNCTION "public"."get_user_activity"("user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_auto_assign_task"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  -- Only create timer if auto_assign is true
  IF NEW.auto_assign = true THEN
    INSERT INTO auto_assignment_timers (
      task_id,
      application_window_minutes,
      window_start,
      window_end
    ) VALUES (
      NEW.id,
      COALESCE(NEW.application_window_minutes, 60),
      now(),
      now() + INTERVAL '1 minute' * COALESCE(NEW.application_window_minutes, 60)
    );
  END IF;
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_new_auto_assign_task"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_task_application"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  bucket_id_var uuid;
  task_info RECORD;
BEGIN
  -- Get task and project info
  SELECT t.*, p.client_id, p.title as project_title
  INTO task_info
  FROM tasks t
  JOIN projects p ON t.project_id = p.id
  WHERE t.id = NEW.task_id;
  
  -- Get or create application bucket
  SELECT id INTO bucket_id_var
  FROM application_buckets
  WHERE task_id = NEW.task_id;
  
  IF bucket_id_var IS NULL THEN
    INSERT INTO application_buckets (
      project_id,
      task_id,
      client_id,
      total_applications,
      reviewed_applications,
      approved_applications,
      rejected_applications,
      status
    ) VALUES (
      task_info.project_id,
      NEW.task_id,
      task_info.client_id,
      1,
      0,
      0,
      0,
      'open'
    ) RETURNING id INTO bucket_id_var;
  ELSE
    -- Update application count
    UPDATE application_buckets
    SET total_applications = total_applications + 1
    WHERE id = bucket_id_var;
  END IF;
  
  -- Set the bucket_id for the new application
  NEW.bucket_id = bucket_id_var;
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_new_task_application"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_project_creation"("project_id" "uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  project_record record;
  room_id uuid;
BEGIN
  -- Validate input
  IF project_id IS NULL THEN
    RETURN NULL;
  END IF;

  -- Get project details
  SELECT * INTO project_record
  FROM projects
  WHERE id = project_id;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  -- Create project group chat
  room_id := create_project_chat(project_id, project_record.client_id);
  
  RETURN room_id;
END;
$$;


ALTER FUNCTION "public"."handle_project_creation"("project_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_task_assignment"("task_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  task_record record;
  direct_chat_id uuid;
  project_chat_id uuid;
  welcome_message text;
BEGIN
  -- Validate input
  IF task_id IS NULL THEN
    RETURN;
  END IF;

  -- Get task and project details
  SELECT t.*, p.client_id, p.title as project_title
  INTO task_record
  FROM tasks t
  JOIN projects p ON t.project_id = p.id
  WHERE t.id = task_id AND t.assignee_id IS NOT NULL;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  -- Create or get direct chat between client and assignee
  direct_chat_id := create_direct_chat(task_record.client_id, task_record.assignee_id);

  -- Insert welcome message
  welcome_message := 'You''ve been connected for task: ' || task_record.title;
  INSERT INTO chat_messages (chat_room_id, sender_id, message)
  VALUES (direct_chat_id, task_record.client_id, welcome_message);

  -- Create or get project group chat and add assignee
  project_chat_id := create_project_chat(task_record.project_id, task_record.client_id);
  PERFORM add_user_to_chat(project_chat_id, task_record.assignee_id);
END;
$$;


ALTER FUNCTION "public"."handle_task_assignment"("task_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."increment_bucket_applications"("bucket_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  UPDATE application_buckets 
  SET total_applications = total_applications + 1
  WHERE id = bucket_id;
END;
$$;


ALTER FUNCTION "public"."increment_bucket_applications"("bucket_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_user_in_chat_room"("room_id" "uuid", "check_user_id" "uuid" DEFAULT "auth"."uid"()) RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM chat_participants
    WHERE chat_room_id = room_id AND user_id = check_user_id
  );
$$;


ALTER FUNCTION "public"."is_user_in_chat_room"("room_id" "uuid", "check_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."process_auto_assignment_timers"() RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  timer_record record;
  application_count integer;
  assigned_worker_id uuid;
  processed_count integer := 0;
BEGIN
  -- Process all active timers that have expired
  FOR timer_record IN
    SELECT * FROM auto_assignment_timers
    WHERE status = 'active' AND window_end <= now()
  LOOP
    -- Check if task has applications
    SELECT COUNT(*) INTO application_count
    FROM task_applications
    WHERE task_id = timer_record.task_id;
    
    IF application_count = 0 THEN
      -- No applications, try to extend timer
      IF extend_auto_assignment_timer(timer_record.task_id) THEN
        -- Timer extended successfully
        CONTINUE;
      ELSE
        -- Max extensions reached, cancel auto-assignment
        UPDATE auto_assignment_timers
        SET status = 'cancelled'
        WHERE id = timer_record.id;
        
        UPDATE tasks
        SET auto_assign = false
        WHERE id = timer_record.task_id;
      END IF;
    ELSE
      -- Applications exist, evaluate and assign
      assigned_worker_id := evaluate_auto_assignment(timer_record.task_id);
      
      IF assigned_worker_id IS NOT NULL THEN
        processed_count := processed_count + 1;
      END IF;
    END IF;
  END LOOP;
  
  RETURN processed_count;
END;
$$;


ALTER FUNCTION "public"."process_auto_assignment_timers"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."start_auto_assignment_timer"("p_task_id" "uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  timer_id uuid;
  task_record record;
  window_minutes integer;
BEGIN
  -- Get task details
  SELECT * INTO task_record
  FROM tasks
  WHERE id = p_task_id AND status = 'open' AND auto_assign = true;
  
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;
  
  -- Get application window (default 60 minutes)
  window_minutes := COALESCE(task_record.application_window_minutes, 60);
  
  -- Create timer
  INSERT INTO auto_assignment_timers (
    task_id,
    application_window_minutes,
    window_start,
    window_end
  ) VALUES (
    p_task_id,
    window_minutes,
    now(),
    now() + (window_minutes || ' minutes')::interval
  )
  RETURNING id INTO timer_id;
  
  RETURN timer_id;
END;
$$;


ALTER FUNCTION "public"."start_auto_assignment_timer"("p_task_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trigger_project_creation"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  -- Create notification for project creator
  INSERT INTO notifications (user_id, title, message, type)
  VALUES (
    NEW.client_id,
    'Project Created',
    'Your project "' || NEW.title || '" has been created successfully',
    'success'
  );
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."trigger_project_creation"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trigger_task_assignment"() RETURNS "trigger"
    LANGUAGE "plpgsql"
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


ALTER FUNCTION "public"."trigger_task_assignment"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."application_buckets" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "project_id" "uuid" NOT NULL,
    "task_id" "uuid" NOT NULL,
    "client_id" "uuid" NOT NULL,
    "total_applications" integer DEFAULT 0,
    "reviewed_applications" integer DEFAULT 0,
    "status" "text" DEFAULT 'open'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "approved_applications" integer DEFAULT 0,
    "rejected_applications" integer DEFAULT 0,
    CONSTRAINT "application_buckets_status_check" CHECK (("status" = ANY (ARRAY['open'::"text", 'reviewing'::"text", 'closed'::"text"])))
);


ALTER TABLE "public"."application_buckets" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."auto_assignment_timers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "task_id" "uuid" NOT NULL,
    "application_window_minutes" integer DEFAULT 60 NOT NULL,
    "window_start" timestamp with time zone DEFAULT "now"() NOT NULL,
    "window_end" timestamp with time zone NOT NULL,
    "extensions_count" integer DEFAULT 0,
    "max_extensions" integer DEFAULT 5,
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "auto_assignment_timers_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'completed'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."auto_assignment_timers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."chat_channels" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "project_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "type" "text" DEFAULT 'project'::"text" NOT NULL,
    "participants" "uuid"[] NOT NULL,
    "created_by" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "chat_channels_type_check" CHECK (("type" = ANY (ARRAY['project'::"text", 'direct'::"text"])))
);


ALTER TABLE "public"."chat_channels" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."chat_messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "chat_room_id" "uuid" NOT NULL,
    "sender_id" "uuid" NOT NULL,
    "message" "text" NOT NULL,
    "sent_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."chat_messages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."chat_participants" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "chat_room_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "joined_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."chat_participants" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."chat_rooms" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "is_group" boolean DEFAULT false NOT NULL,
    "project_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."chat_rooms" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."favorites" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "favorite_user_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."favorites" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."invitations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "task_id" "uuid" NOT NULL,
    "client_id" "uuid" NOT NULL,
    "worker_id" "uuid" NOT NULL,
    "message" "text",
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "invitations_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'accepted'::"text", 'declined'::"text"])))
);


ALTER TABLE "public"."invitations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notifications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "message" "text" NOT NULL,
    "type" "text" DEFAULT 'info'::"text" NOT NULL,
    "read" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "notifications_type_check" CHECK (("type" = ANY (ARRAY['info'::"text", 'success'::"text", 'warning'::"text", 'error'::"text"])))
);


ALTER TABLE "public"."notifications" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."old__chat_messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "channel_id" "uuid" NOT NULL,
    "sender_id" "uuid" NOT NULL,
    "content" "text" NOT NULL,
    "message_type" "text" DEFAULT 'text'::"text",
    "file_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "chat_messages_message_type_check" CHECK (("message_type" = ANY (ARRAY['text'::"text", 'file'::"text", 'system'::"text"])))
);


ALTER TABLE "public"."old__chat_messages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."old__chat_participants" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "chat_room_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "joined_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."old__chat_participants" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."old__chat_rooms" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "is_group" boolean DEFAULT false NOT NULL,
    "project_id" "uuid",
    "name" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."old__chat_rooms" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."projects" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "client_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text" NOT NULL,
    "tags" "text"[] DEFAULT '{}'::"text"[],
    "budget" numeric(10,2) NOT NULL,
    "status" "text" DEFAULT 'open'::"text" NOT NULL,
    "requirements_form" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "projects_budget_check" CHECK (("budget" > (0)::numeric)),
    CONSTRAINT "projects_status_check" CHECK (("status" = ANY (ARRAY['open'::"text", 'in_progress'::"text", 'completed'::"text", 'closed'::"text"])))
);


ALTER TABLE "public"."projects" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."proposals" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "task_id" "uuid" NOT NULL,
    "worker_id" "uuid" NOT NULL,
    "cover_letter" "text" NOT NULL,
    "proposed_rate" numeric(10,2),
    "estimated_hours" integer,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "proposals_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'accepted'::"text", 'rejected'::"text"])))
);


ALTER TABLE "public"."proposals" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."submissions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "task_id" "uuid" NOT NULL,
    "worker_id" "uuid" NOT NULL,
    "files" "text"[] DEFAULT '{}'::"text"[],
    "comments" "text" NOT NULL,
    "verified_by" "text",
    "outcome" "text" DEFAULT 'pending'::"text" NOT NULL,
    "submitted_at" timestamp with time zone DEFAULT "now"(),
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "submissions_outcome_check" CHECK (("outcome" = ANY (ARRAY['pass'::"text", 'fail'::"text", 'pending'::"text"]))),
    CONSTRAINT "submissions_verified_by_check" CHECK (("verified_by" = ANY (ARRAY['ai'::"text", 'client'::"text"])))
);


ALTER TABLE "public"."submissions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."task_applications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "task_id" "uuid" NOT NULL,
    "worker_id" "uuid" NOT NULL,
    "applied_at" timestamp with time zone DEFAULT "now"(),
    "bucket_id" "uuid",
    "selected" boolean DEFAULT false,
    "reviewed" boolean DEFAULT false,
    "status" "text" DEFAULT 'pending'::"text",
    CONSTRAINT "task_applications_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'approved'::"text", 'rejected'::"text"])))
);


ALTER TABLE "public"."task_applications" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tasks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "project_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text" NOT NULL,
    "requirements_form" "jsonb",
    "weight" integer DEFAULT 1 NOT NULL,
    "assignee_id" "uuid",
    "status" "text" DEFAULT 'open'::"text" NOT NULL,
    "payout" numeric(10,2) NOT NULL,
    "deadline" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "pricing_type" "text" DEFAULT 'fixed'::"text",
    "hourly_rate" numeric(10,2),
    "estimated_hours" integer,
    "application_deadline" timestamp with time zone,
    "required_skills" "text"[] DEFAULT '{}'::"text"[],
    "auto_assign" boolean DEFAULT true,
    "application_window_minutes" integer DEFAULT 60,
    "success_criteria" character varying DEFAULT ''::character varying,
    "detailed_tasks" character varying DEFAULT ''::character varying,
    "priority" integer DEFAULT 0,
    "budget" integer DEFAULT 0,
    CONSTRAINT "tasks_payout_check" CHECK (("payout" > (0)::numeric)),
    CONSTRAINT "tasks_pricing_type_check" CHECK (("pricing_type" = ANY (ARRAY['fixed'::"text", 'hourly'::"text"]))),
    CONSTRAINT "tasks_status_check" CHECK (("status" = ANY (ARRAY['open'::"text", 'assigned'::"text", 'submitted'::"text", 'approved'::"text", 'rejected'::"text"]))),
    CONSTRAINT "tasks_weight_check" CHECK ((("weight" >= 1) AND ("weight" <= 10)))
);


ALTER TABLE "public"."tasks" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."users" (
    "id" "uuid" NOT NULL,
    "email" "text" NOT NULL,
    "name" "text",
    "role" "text" NOT NULL,
    "skills" "text"[] DEFAULT '{}'::"text"[],
    "rating" numeric(3,2) DEFAULT 0,
    "wallet_balance" numeric(10,2) DEFAULT 0,
    "avatar_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "tier" "text" DEFAULT 'bronze'::"text",
    "onboarding_completed" boolean DEFAULT false,
    CONSTRAINT "users_rating_check" CHECK ((("rating" >= (0)::numeric) AND ("rating" <= (5)::numeric))),
    CONSTRAINT "users_role_check" CHECK (("role" = ANY (ARRAY['client'::"text", 'worker'::"text"]))),
    CONSTRAINT "users_tier_check" CHECK (("tier" = ANY (ARRAY['bronze'::"text", 'silver'::"text", 'gold'::"text", 'platinum'::"text"])))
);


ALTER TABLE "public"."users" OWNER TO "postgres";


ALTER TABLE ONLY "public"."application_buckets"
    ADD CONSTRAINT "application_buckets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."application_buckets"
    ADD CONSTRAINT "application_buckets_task_id_key" UNIQUE ("task_id");



ALTER TABLE ONLY "public"."auto_assignment_timers"
    ADD CONSTRAINT "auto_assignment_timers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."auto_assignment_timers"
    ADD CONSTRAINT "auto_assignment_timers_task_id_key" UNIQUE ("task_id");



ALTER TABLE ONLY "public"."chat_channels"
    ADD CONSTRAINT "chat_channels_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."old__chat_messages"
    ADD CONSTRAINT "chat_messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."chat_messages"
    ADD CONSTRAINT "chat_messages_pkey1" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."old__chat_participants"
    ADD CONSTRAINT "chat_participants_chat_room_id_user_id_key" UNIQUE ("chat_room_id", "user_id");



ALTER TABLE ONLY "public"."chat_participants"
    ADD CONSTRAINT "chat_participants_chat_room_id_user_id_key1" UNIQUE ("chat_room_id", "user_id");



ALTER TABLE ONLY "public"."old__chat_participants"
    ADD CONSTRAINT "chat_participants_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."chat_participants"
    ADD CONSTRAINT "chat_participants_pkey1" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."old__chat_rooms"
    ADD CONSTRAINT "chat_rooms_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."chat_rooms"
    ADD CONSTRAINT "chat_rooms_pkey1" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."favorites"
    ADD CONSTRAINT "favorites_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."favorites"
    ADD CONSTRAINT "favorites_user_id_favorite_user_id_key" UNIQUE ("user_id", "favorite_user_id");



ALTER TABLE ONLY "public"."invitations"
    ADD CONSTRAINT "invitations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."invitations"
    ADD CONSTRAINT "invitations_task_id_worker_id_key" UNIQUE ("task_id", "worker_id");



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."projects"
    ADD CONSTRAINT "projects_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."proposals"
    ADD CONSTRAINT "proposals_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."proposals"
    ADD CONSTRAINT "proposals_task_id_worker_id_key" UNIQUE ("task_id", "worker_id");



ALTER TABLE ONLY "public"."submissions"
    ADD CONSTRAINT "submissions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."task_applications"
    ADD CONSTRAINT "task_applications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."task_applications"
    ADD CONSTRAINT "task_applications_task_id_worker_id_key" UNIQUE ("task_id", "worker_id");



ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "tasks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_pkey" PRIMARY KEY ("id");



CREATE INDEX "idx_chat_messages_chat_room_id" ON "public"."chat_messages" USING "btree" ("chat_room_id");



CREATE INDEX "idx_chat_messages_sender_id" ON "public"."chat_messages" USING "btree" ("sender_id");



CREATE INDEX "idx_chat_messages_sent_at" ON "public"."chat_messages" USING "btree" ("sent_at" DESC);



CREATE INDEX "idx_chat_participants_chat_room_id" ON "public"."chat_participants" USING "btree" ("chat_room_id");



CREATE INDEX "idx_chat_participants_lookup" ON "public"."chat_participants" USING "btree" ("chat_room_id", "user_id");



CREATE INDEX "idx_chat_participants_user_id" ON "public"."chat_participants" USING "btree" ("user_id");



CREATE INDEX "idx_chat_rooms_is_group" ON "public"."chat_rooms" USING "btree" ("is_group");



CREATE INDEX "idx_chat_rooms_project_group" ON "public"."chat_rooms" USING "btree" ("project_id", "is_group") WHERE ("is_group" = true);



CREATE INDEX "idx_chat_rooms_project_id" ON "public"."chat_rooms" USING "btree" ("project_id");



CREATE INDEX "idx_task_applications_bucket_id" ON "public"."task_applications" USING "btree" ("bucket_id");



CREATE INDEX "idx_task_applications_status" ON "public"."task_applications" USING "btree" ("status");



CREATE INDEX "idx_task_applications_worker_task" ON "public"."task_applications" USING "btree" ("worker_id", "task_id");



CREATE OR REPLACE TRIGGER "project_creation_chat_trigger" AFTER INSERT ON "public"."projects" FOR EACH ROW EXECUTE FUNCTION "public"."trigger_project_creation"();



CREATE OR REPLACE TRIGGER "task_assignment_chat_trigger" AFTER UPDATE OF "assignee_id" ON "public"."tasks" FOR EACH ROW EXECUTE FUNCTION "public"."trigger_task_assignment"();



CREATE OR REPLACE TRIGGER "trigger_new_auto_assign_task" AFTER INSERT ON "public"."tasks" FOR EACH ROW EXECUTE FUNCTION "public"."handle_new_auto_assign_task"();



CREATE OR REPLACE TRIGGER "trigger_new_task_application" BEFORE INSERT ON "public"."task_applications" FOR EACH ROW EXECUTE FUNCTION "public"."handle_new_task_application"();



CREATE OR REPLACE TRIGGER "update_application_buckets_updated_at" BEFORE UPDATE ON "public"."application_buckets" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_auto_assignment_timers_updated_at" BEFORE UPDATE ON "public"."auto_assignment_timers" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_chat_channels_updated_at" BEFORE UPDATE ON "public"."chat_channels" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_invitations_updated_at" BEFORE UPDATE ON "public"."invitations" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_notifications_updated_at" BEFORE UPDATE ON "public"."notifications" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_projects_updated_at" BEFORE UPDATE ON "public"."projects" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_proposals_updated_at" BEFORE UPDATE ON "public"."proposals" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_submissions_updated_at" BEFORE UPDATE ON "public"."submissions" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_tasks_updated_at" BEFORE UPDATE ON "public"."tasks" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_users_updated_at" BEFORE UPDATE ON "public"."users" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



ALTER TABLE ONLY "public"."application_buckets"
    ADD CONSTRAINT "application_buckets_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."application_buckets"
    ADD CONSTRAINT "application_buckets_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."application_buckets"
    ADD CONSTRAINT "application_buckets_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."auto_assignment_timers"
    ADD CONSTRAINT "auto_assignment_timers_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."chat_channels"
    ADD CONSTRAINT "chat_channels_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."chat_channels"
    ADD CONSTRAINT "chat_channels_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."old__chat_messages"
    ADD CONSTRAINT "chat_messages_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "public"."chat_channels"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."chat_messages"
    ADD CONSTRAINT "chat_messages_chat_room_id_fkey" FOREIGN KEY ("chat_room_id") REFERENCES "public"."chat_rooms"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."old__chat_messages"
    ADD CONSTRAINT "chat_messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."chat_messages"
    ADD CONSTRAINT "chat_messages_sender_id_fkey1" FOREIGN KEY ("sender_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."old__chat_participants"
    ADD CONSTRAINT "chat_participants_chat_room_id_fkey" FOREIGN KEY ("chat_room_id") REFERENCES "public"."old__chat_rooms"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."chat_participants"
    ADD CONSTRAINT "chat_participants_chat_room_id_fkey1" FOREIGN KEY ("chat_room_id") REFERENCES "public"."chat_rooms"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."old__chat_participants"
    ADD CONSTRAINT "chat_participants_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."chat_participants"
    ADD CONSTRAINT "chat_participants_user_id_fkey1" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."old__chat_rooms"
    ADD CONSTRAINT "chat_rooms_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."chat_rooms"
    ADD CONSTRAINT "chat_rooms_project_id_fkey1" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."favorites"
    ADD CONSTRAINT "favorites_favorite_user_id_fkey" FOREIGN KEY ("favorite_user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."favorites"
    ADD CONSTRAINT "favorites_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."invitations"
    ADD CONSTRAINT "invitations_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."invitations"
    ADD CONSTRAINT "invitations_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."invitations"
    ADD CONSTRAINT "invitations_worker_id_fkey" FOREIGN KEY ("worker_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."projects"
    ADD CONSTRAINT "projects_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."proposals"
    ADD CONSTRAINT "proposals_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."proposals"
    ADD CONSTRAINT "proposals_worker_id_fkey" FOREIGN KEY ("worker_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."submissions"
    ADD CONSTRAINT "submissions_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."submissions"
    ADD CONSTRAINT "submissions_worker_id_fkey" FOREIGN KEY ("worker_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."task_applications"
    ADD CONSTRAINT "task_applications_bucket_id_fkey" FOREIGN KEY ("bucket_id") REFERENCES "public"."application_buckets"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."task_applications"
    ADD CONSTRAINT "task_applications_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."task_applications"
    ADD CONSTRAINT "task_applications_worker_id_fkey" FOREIGN KEY ("worker_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "tasks_assignee_id_fkey" FOREIGN KEY ("assignee_id") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "tasks_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



CREATE POLICY "Allow inserting any notification" ON "public"."notifications" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Clients can manage own application buckets" ON "public"."application_buckets" TO "authenticated" USING (("client_id" = "auth"."uid"()));



CREATE POLICY "Clients can manage own invitations" ON "public"."invitations" TO "authenticated" USING (("client_id" = "auth"."uid"()));



CREATE POLICY "Clients can manage own projects" ON "public"."projects" TO "authenticated" USING (("client_id" = "auth"."uid"()));



CREATE POLICY "Clients can manage tasks in own projects" ON "public"."tasks" TO "authenticated" USING (("project_id" IN ( SELECT "projects"."id"
   FROM "public"."projects"
  WHERE ("projects"."client_id" = "auth"."uid"()))));



CREATE POLICY "Clients can update applications for their tasks" ON "public"."task_applications" FOR UPDATE TO "authenticated" USING (("task_id" IN ( SELECT "t"."id"
   FROM ("public"."tasks" "t"
     JOIN "public"."projects" "p" ON (("t"."project_id" = "p"."id")))
  WHERE ("p"."client_id" = "auth"."uid"())))) WITH CHECK (("task_id" IN ( SELECT "t"."id"
   FROM ("public"."tasks" "t"
     JOIN "public"."projects" "p" ON (("t"."project_id" = "p"."id")))
  WHERE ("p"."client_id" = "auth"."uid"()))));



CREATE POLICY "Clients can update proposals for their tasks" ON "public"."proposals" FOR UPDATE TO "authenticated" USING (("task_id" IN ( SELECT "t"."id"
   FROM ("public"."tasks" "t"
     JOIN "public"."projects" "p" ON (("t"."project_id" = "p"."id")))
  WHERE ("p"."client_id" = "auth"."uid"()))));



CREATE POLICY "Clients can view applications for their tasks" ON "public"."task_applications" FOR SELECT TO "authenticated" USING (("task_id" IN ( SELECT "t"."id"
   FROM ("public"."tasks" "t"
     JOIN "public"."projects" "p" ON (("t"."project_id" = "p"."id")))
  WHERE ("p"."client_id" = "auth"."uid"()))));



CREATE POLICY "Clients can view proposals for their tasks" ON "public"."proposals" FOR SELECT TO "authenticated" USING (("task_id" IN ( SELECT "t"."id"
   FROM ("public"."tasks" "t"
     JOIN "public"."projects" "p" ON (("t"."project_id" = "p"."id")))
  WHERE ("p"."client_id" = "auth"."uid"()))));



CREATE POLICY "Clients can view submissions for own projects" ON "public"."submissions" FOR SELECT TO "authenticated" USING (("task_id" IN ( SELECT "t"."id"
   FROM ("public"."tasks" "t"
     JOIN "public"."projects" "p" ON (("t"."project_id" = "p"."id")))
  WHERE ("p"."client_id" = "auth"."uid"()))));



CREATE POLICY "Clients can view timers for own tasks" ON "public"."auto_assignment_timers" FOR SELECT TO "authenticated" USING (("task_id" IN ( SELECT "t"."id"
   FROM ("public"."tasks" "t"
     JOIN "public"."projects" "p" ON (("t"."project_id" = "p"."id")))
  WHERE ("p"."client_id" = "auth"."uid"()))));



CREATE POLICY "System can manage auto-assignment timers" ON "public"."auto_assignment_timers" TO "authenticated" USING (true);



CREATE POLICY "Users can create chat rooms" ON "public"."old__chat_rooms" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Users can create project channels" ON "public"."chat_channels" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "created_by"));



CREATE POLICY "Users can insert own profile" ON "public"."users" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "id"));



CREATE POLICY "Users can join chats they have access to" ON "public"."chat_participants" FOR INSERT TO "authenticated" WITH CHECK ((("user_id" = "auth"."uid"()) OR ("chat_room_id" IN ( SELECT "cr"."id"
   FROM ("public"."chat_rooms" "cr"
     JOIN "public"."projects" "p" ON (("cr"."project_id" = "p"."id")))
  WHERE ("p"."client_id" = "auth"."uid"())))));



CREATE POLICY "Users can join chats they have access to" ON "public"."old__chat_participants" FOR INSERT TO "authenticated" WITH CHECK ((("user_id" = "auth"."uid"()) OR ("chat_room_id" IN ( SELECT "cr"."id"
   FROM ("public"."old__chat_rooms" "cr"
     JOIN "public"."projects" "p" ON (("cr"."project_id" = "p"."id")))
  WHERE ("p"."client_id" = "auth"."uid"())))));



CREATE POLICY "Users can manage own favorites" ON "public"."favorites" TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can manage own notifications" ON "public"."notifications" TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can see participants in their rooms" ON "public"."chat_participants" FOR SELECT USING (("chat_room_id" IN ( SELECT "chat_participants_1"."chat_room_id"
   FROM "public"."chat_participants" "chat_participants_1"
  WHERE ("chat_participants_1"."user_id" = "auth"."uid"()))));



CREATE POLICY "Users can see their chat participations" ON "public"."chat_participants" FOR SELECT USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can send messages to their channels" ON "public"."old__chat_messages" FOR INSERT TO "authenticated" WITH CHECK (("channel_id" IN ( SELECT "chat_channels"."id"
   FROM "public"."chat_channels"
  WHERE ("auth"."uid"() = ANY ("chat_channels"."participants")))));



CREATE POLICY "Users can send messages to their chat rooms" ON "public"."chat_messages" FOR INSERT TO "authenticated" WITH CHECK ((("sender_id" = "auth"."uid"()) AND ("chat_room_id" IN ( SELECT "chat_participants"."chat_room_id"
   FROM "public"."chat_participants"
  WHERE ("chat_participants"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can update own profile" ON "public"."users" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "id"));



CREATE POLICY "Users can view channels they participate in" ON "public"."chat_channels" FOR SELECT TO "authenticated" USING (("auth"."uid"() = ANY ("participants")));



CREATE POLICY "Users can view messages in their channels" ON "public"."old__chat_messages" FOR SELECT TO "authenticated" USING (("channel_id" IN ( SELECT "chat_channels"."id"
   FROM "public"."chat_channels"
  WHERE ("auth"."uid"() = ANY ("chat_channels"."participants")))));



CREATE POLICY "Users can view messages in their chat rooms" ON "public"."chat_messages" FOR SELECT TO "authenticated" USING (("chat_room_id" IN ( SELECT "chat_participants"."chat_room_id"
   FROM "public"."chat_participants"
  WHERE ("chat_participants"."user_id" = "auth"."uid"()))));



CREATE POLICY "Users can view participants in their chats" ON "public"."chat_participants" FOR SELECT TO "authenticated" USING ("public"."is_user_in_chat_room"("chat_room_id"));



CREATE POLICY "Users can view participants in their chats" ON "public"."old__chat_participants" FOR SELECT TO "authenticated" USING (("chat_room_id" IN ( SELECT "old__chat_participants_1"."chat_room_id"
   FROM "public"."old__chat_participants" "old__chat_participants_1"
  WHERE ("old__chat_participants_1"."user_id" = "auth"."uid"()))));



CREATE POLICY "Users can view their chat rooms" ON "public"."chat_rooms" FOR SELECT TO "authenticated" USING (("id" IN ( SELECT "chat_participants"."chat_room_id"
   FROM "public"."chat_participants"
  WHERE ("chat_participants"."user_id" = "auth"."uid"()))));



CREATE POLICY "Users can view their chat rooms" ON "public"."old__chat_rooms" FOR SELECT TO "authenticated" USING (("id" IN ( SELECT "old__chat_participants"."chat_room_id"
   FROM "public"."old__chat_participants"
  WHERE ("old__chat_participants"."user_id" = "auth"."uid"()))));



CREATE POLICY "Workers can claim open tasks" ON "public"."tasks" FOR UPDATE TO "authenticated" USING ((("status" = 'open'::"text") AND ("assignee_id" IS NULL))) WITH CHECK ((("assignee_id" = "auth"."uid"()) AND ("status" = 'assigned'::"text")));



CREATE POLICY "Workers can create application buckets" ON "public"."application_buckets" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Workers can create proposals" ON "public"."proposals" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "worker_id"));



CREATE POLICY "Workers can create task applications" ON "public"."task_applications" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "worker_id"));



CREATE POLICY "Workers can manage own applications" ON "public"."task_applications" TO "authenticated" USING (("worker_id" = "auth"."uid"()));



CREATE POLICY "Workers can manage own proposals" ON "public"."proposals" TO "authenticated" USING (("worker_id" = "auth"."uid"()));



CREATE POLICY "Workers can manage own submissions" ON "public"."submissions" TO "authenticated" USING (("worker_id" = "auth"."uid"()));



CREATE POLICY "Workers can read application buckets" ON "public"."application_buckets" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Workers can update application buckets" ON "public"."application_buckets" FOR UPDATE TO "authenticated" USING (true);



CREATE POLICY "Workers can update assigned tasks" ON "public"."tasks" FOR UPDATE TO "authenticated" USING (("assignee_id" = "auth"."uid"())) WITH CHECK (("assignee_id" = "auth"."uid"()));



CREATE POLICY "Workers can view and respond to their invitations" ON "public"."invitations" TO "authenticated" USING (("worker_id" = "auth"."uid"()));



CREATE POLICY "Workers can view available tasks" ON "public"."tasks" FOR SELECT TO "authenticated" USING ((("status" = 'open'::"text") OR ("assignee_id" = "auth"."uid"()) OR ("project_id" IN ( SELECT "projects"."id"
   FROM "public"."projects"
  WHERE ("projects"."client_id" = "auth"."uid"())))));



CREATE POLICY "Workers can view open projects" ON "public"."projects" FOR SELECT TO "authenticated" USING ((("status" = 'open'::"text") OR ("client_id" = "auth"."uid"())));



CREATE POLICY "Workers can view timers for tasks they've applied to" ON "public"."auto_assignment_timers" FOR SELECT TO "authenticated" USING (("task_id" IN ( SELECT "ta"."task_id"
   FROM "public"."task_applications" "ta"
  WHERE ("ta"."worker_id" = "auth"."uid"()))));



ALTER TABLE "public"."application_buckets" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."chat_channels" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."chat_messages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."chat_rooms" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."favorites" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."invitations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."notifications" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."old__chat_messages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."old__chat_participants" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."old__chat_rooms" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."projects" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."proposals" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."submissions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."task_applications" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tasks" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";






ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."chat_messages";



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";

























































































































































GRANT ALL ON FUNCTION "public"."add_user_to_chat"("room_id" "uuid", "new_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."add_user_to_chat"("room_id" "uuid", "new_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."add_user_to_chat"("room_id" "uuid", "new_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."auto_assign_task"("task_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."auto_assign_task"("task_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."auto_assign_task"("task_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."calculate_application_score"("worker_skills" "text"[], "required_skills" "text"[], "worker_rating" numeric, "application_time" timestamp with time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."calculate_application_score"("worker_skills" "text"[], "required_skills" "text"[], "worker_rating" numeric, "application_time" timestamp with time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."calculate_application_score"("worker_skills" "text"[], "required_skills" "text"[], "worker_rating" numeric, "application_time" timestamp with time zone) TO "service_role";



GRANT ALL ON FUNCTION "public"."calculate_worker_score"("worker_skills" "text"[], "required_skills" "text"[], "worker_rating" numeric) TO "anon";
GRANT ALL ON FUNCTION "public"."calculate_worker_score"("worker_skills" "text"[], "required_skills" "text"[], "worker_rating" numeric) TO "authenticated";
GRANT ALL ON FUNCTION "public"."calculate_worker_score"("worker_skills" "text"[], "required_skills" "text"[], "worker_rating" numeric) TO "service_role";



GRANT ALL ON FUNCTION "public"."create_direct_chat"("user1_id" "uuid", "user2_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."create_direct_chat"("user1_id" "uuid", "user2_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_direct_chat"("user1_id" "uuid", "user2_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_notification_for_user"("target_user_id" "uuid", "notification_title" "text", "notification_message" "text", "notification_type" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."create_notification_for_user"("target_user_id" "uuid", "notification_title" "text", "notification_message" "text", "notification_type" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_notification_for_user"("target_user_id" "uuid", "notification_title" "text", "notification_message" "text", "notification_type" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_project_chat"("p_project_id" "uuid", "creator_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."create_project_chat"("p_project_id" "uuid", "creator_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_project_chat"("p_project_id" "uuid", "creator_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."evaluate_auto_assignment"("p_task_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."evaluate_auto_assignment"("p_task_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."evaluate_auto_assignment"("p_task_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."extend_auto_assignment_timer"("p_task_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."extend_auto_assignment_timer"("p_task_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."extend_auto_assignment_timer"("p_task_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_or_create_application_bucket"("p_task_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_or_create_application_bucket"("p_task_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_or_create_application_bucket"("p_task_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_project_stats"("client_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_project_stats"("client_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_project_stats"("client_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_activity"("user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_activity"("user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_activity"("user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_auto_assign_task"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_auto_assign_task"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_auto_assign_task"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_task_application"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_task_application"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_task_application"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_project_creation"("project_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."handle_project_creation"("project_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_project_creation"("project_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_task_assignment"("task_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."handle_task_assignment"("task_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_task_assignment"("task_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."increment_bucket_applications"("bucket_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."increment_bucket_applications"("bucket_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."increment_bucket_applications"("bucket_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_user_in_chat_room"("room_id" "uuid", "check_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_user_in_chat_room"("room_id" "uuid", "check_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_user_in_chat_room"("room_id" "uuid", "check_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."process_auto_assignment_timers"() TO "anon";
GRANT ALL ON FUNCTION "public"."process_auto_assignment_timers"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."process_auto_assignment_timers"() TO "service_role";



GRANT ALL ON FUNCTION "public"."start_auto_assignment_timer"("p_task_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."start_auto_assignment_timer"("p_task_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."start_auto_assignment_timer"("p_task_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."trigger_project_creation"() TO "anon";
GRANT ALL ON FUNCTION "public"."trigger_project_creation"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trigger_project_creation"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trigger_task_assignment"() TO "anon";
GRANT ALL ON FUNCTION "public"."trigger_task_assignment"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trigger_task_assignment"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";


















GRANT ALL ON TABLE "public"."application_buckets" TO "anon";
GRANT ALL ON TABLE "public"."application_buckets" TO "authenticated";
GRANT ALL ON TABLE "public"."application_buckets" TO "service_role";



GRANT ALL ON TABLE "public"."auto_assignment_timers" TO "anon";
GRANT ALL ON TABLE "public"."auto_assignment_timers" TO "authenticated";
GRANT ALL ON TABLE "public"."auto_assignment_timers" TO "service_role";



GRANT ALL ON TABLE "public"."chat_channels" TO "anon";
GRANT ALL ON TABLE "public"."chat_channels" TO "authenticated";
GRANT ALL ON TABLE "public"."chat_channels" TO "service_role";



GRANT ALL ON TABLE "public"."chat_messages" TO "anon";
GRANT ALL ON TABLE "public"."chat_messages" TO "authenticated";
GRANT ALL ON TABLE "public"."chat_messages" TO "service_role";



GRANT ALL ON TABLE "public"."chat_participants" TO "anon";
GRANT ALL ON TABLE "public"."chat_participants" TO "authenticated";
GRANT ALL ON TABLE "public"."chat_participants" TO "service_role";



GRANT ALL ON TABLE "public"."chat_rooms" TO "anon";
GRANT ALL ON TABLE "public"."chat_rooms" TO "authenticated";
GRANT ALL ON TABLE "public"."chat_rooms" TO "service_role";



GRANT ALL ON TABLE "public"."favorites" TO "anon";
GRANT ALL ON TABLE "public"."favorites" TO "authenticated";
GRANT ALL ON TABLE "public"."favorites" TO "service_role";



GRANT ALL ON TABLE "public"."invitations" TO "anon";
GRANT ALL ON TABLE "public"."invitations" TO "authenticated";
GRANT ALL ON TABLE "public"."invitations" TO "service_role";



GRANT ALL ON TABLE "public"."notifications" TO "anon";
GRANT ALL ON TABLE "public"."notifications" TO "authenticated";
GRANT ALL ON TABLE "public"."notifications" TO "service_role";



GRANT ALL ON TABLE "public"."old__chat_messages" TO "anon";
GRANT ALL ON TABLE "public"."old__chat_messages" TO "authenticated";
GRANT ALL ON TABLE "public"."old__chat_messages" TO "service_role";



GRANT ALL ON TABLE "public"."old__chat_participants" TO "anon";
GRANT ALL ON TABLE "public"."old__chat_participants" TO "authenticated";
GRANT ALL ON TABLE "public"."old__chat_participants" TO "service_role";



GRANT ALL ON TABLE "public"."old__chat_rooms" TO "anon";
GRANT ALL ON TABLE "public"."old__chat_rooms" TO "authenticated";
GRANT ALL ON TABLE "public"."old__chat_rooms" TO "service_role";



GRANT ALL ON TABLE "public"."projects" TO "anon";
GRANT ALL ON TABLE "public"."projects" TO "authenticated";
GRANT ALL ON TABLE "public"."projects" TO "service_role";



GRANT ALL ON TABLE "public"."proposals" TO "anon";
GRANT ALL ON TABLE "public"."proposals" TO "authenticated";
GRANT ALL ON TABLE "public"."proposals" TO "service_role";



GRANT ALL ON TABLE "public"."submissions" TO "anon";
GRANT ALL ON TABLE "public"."submissions" TO "authenticated";
GRANT ALL ON TABLE "public"."submissions" TO "service_role";



GRANT ALL ON TABLE "public"."task_applications" TO "anon";
GRANT ALL ON TABLE "public"."task_applications" TO "authenticated";
GRANT ALL ON TABLE "public"."task_applications" TO "service_role";



GRANT ALL ON TABLE "public"."tasks" TO "anon";
GRANT ALL ON TABLE "public"."tasks" TO "authenticated";
GRANT ALL ON TABLE "public"."tasks" TO "service_role";



GRANT ALL ON TABLE "public"."users" TO "anon";
GRANT ALL ON TABLE "public"."users" TO "authenticated";
GRANT ALL ON TABLE "public"."users" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";






























RESET ALL;
