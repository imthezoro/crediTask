/*
  # Chat System Validation Tests
  
  This migration performs comprehensive validation of the chat system:
  1. Tables & Columns verification
  2. Row-Level Security (RLS) validation
  3. Functions testing
  4. Trigger testing
  
  Run this after applying the chat system migration to validate everything works.
*/

-- ============================================================================
-- 🔎 1. TABLES & COLUMNS VALIDATION
-- ============================================================================

DO $$
DECLARE
  table_exists boolean;
  column_count integer;
  missing_columns text[];
BEGIN
  RAISE NOTICE '=== VALIDATING TABLES & COLUMNS ===';
  
  -- Check chat_rooms table
  SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'chat_rooms'
  ) INTO table_exists;
  
  IF NOT table_exists THEN
    RAISE EXCEPTION 'FAIL: chat_rooms table does not exist';
  END IF;
  
  -- Check chat_rooms columns
  SELECT COUNT(*) INTO column_count
  FROM information_schema.columns 
  WHERE table_schema = 'public' AND table_name = 'chat_rooms'
    AND column_name IN ('id', 'is_group', 'project_id', 'created_at');
    
  IF column_count != 4 THEN
    RAISE EXCEPTION 'FAIL: chat_rooms missing required columns. Found % of 4', column_count;
  END IF;
  
  RAISE NOTICE 'PASS: chat_rooms table exists with correct columns';
  
  -- Check chat_participants table
  SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'chat_participants'
  ) INTO table_exists;
  
  IF NOT table_exists THEN
    RAISE EXCEPTION 'FAIL: chat_participants table does not exist';
  END IF;
  
  -- Check chat_participants columns
  SELECT COUNT(*) INTO column_count
  FROM information_schema.columns 
  WHERE table_schema = 'public' AND table_name = 'chat_participants'
    AND column_name IN ('id', 'chat_room_id', 'user_id', 'joined_at');
    
  IF column_count != 4 THEN
    RAISE EXCEPTION 'FAIL: chat_participants missing required columns. Found % of 4', column_count;
  END IF;
  
  RAISE NOTICE 'PASS: chat_participants table exists with correct columns';
  
  -- Check chat_messages table
  SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'chat_messages'
  ) INTO table_exists;
  
  IF NOT table_exists THEN
    RAISE EXCEPTION 'FAIL: chat_messages table does not exist';
  END IF;
  
  -- Check chat_messages columns
  SELECT COUNT(*) INTO column_count
  FROM information_schema.columns 
  WHERE table_schema = 'public' AND table_name = 'chat_messages'
    AND column_name IN ('id', 'chat_room_id', 'sender_id', 'message', 'sent_at');
    
  IF column_count != 5 THEN
    RAISE EXCEPTION 'FAIL: chat_messages missing required columns. Found % of 5', column_count;
  END IF;
  
  RAISE NOTICE 'PASS: chat_messages table exists with correct columns';
  RAISE NOTICE '✅ ALL TABLES AND COLUMNS VALIDATED SUCCESSFULLY';
END $$;

-- ============================================================================
-- 🧠 2. ROW-LEVEL SECURITY (RLS) VALIDATION
-- ============================================================================

DO $$
DECLARE
  rls_enabled boolean;
  policy_count integer;
  expected_policies text[] := ARRAY[
    'Users can view their chat rooms',
    'Users can create chat rooms',
    'Users can view participants in their chats', 
    'Users can join chats they have access to',
    'Users can view messages in their chat rooms',
    'Users can send messages to their chat rooms'
  ];
  policy_name text;
  found_policies text[] := '{}';
BEGIN
  RAISE NOTICE '=== VALIDATING ROW-LEVEL SECURITY ===';
  
  -- Check RLS enabled on chat_rooms
  SELECT relrowsecurity INTO rls_enabled
  FROM pg_class 
  WHERE relname = 'chat_rooms' AND relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');
  
  IF NOT rls_enabled THEN
    RAISE EXCEPTION 'FAIL: RLS not enabled on chat_rooms';
  END IF;
  RAISE NOTICE 'PASS: RLS enabled on chat_rooms';
  
  -- Check RLS enabled on chat_participants
  SELECT relrowsecurity INTO rls_enabled
  FROM pg_class 
  WHERE relname = 'chat_participants' AND relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');
  
  IF NOT rls_enabled THEN
    RAISE EXCEPTION 'FAIL: RLS not enabled on chat_participants';
  END IF;
  RAISE NOTICE 'PASS: RLS enabled on chat_participants';
  
  -- Check RLS enabled on chat_messages
  SELECT relrowsecurity INTO rls_enabled
  FROM pg_class 
  WHERE relname = 'chat_messages' AND relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');
  
  IF NOT rls_enabled THEN
    RAISE EXCEPTION 'FAIL: RLS not enabled on chat_messages';
  END IF;
  RAISE NOTICE 'PASS: RLS enabled on chat_messages';
  
  -- Check policies exist
  FOR policy_name IN SELECT unnest(expected_policies) LOOP
    IF EXISTS (
      SELECT 1 FROM pg_policies 
      WHERE schemaname = 'public' AND policyname = policy_name
    ) THEN
      found_policies := array_append(found_policies, policy_name);
      RAISE NOTICE 'PASS: Policy "%" exists', policy_name;
    ELSE
      RAISE EXCEPTION 'FAIL: Policy "%" does not exist', policy_name;
    END IF;
  END LOOP;
  
  RAISE NOTICE '✅ ALL RLS POLICIES VALIDATED SUCCESSFULLY';
END $$;

-- ============================================================================
-- ⚙️ 3. FUNCTIONS VALIDATION
-- ============================================================================

DO $$
DECLARE
  function_exists boolean;
  expected_functions text[] := ARRAY[
    'create_direct_chat',
    'create_project_chat', 
    'add_user_to_chat',
    'handle_task_assignment',
    'handle_project_creation'
  ];
  func_name text;
BEGIN
  RAISE NOTICE '=== VALIDATING FUNCTIONS ===';
  
  FOR func_name IN SELECT unnest(expected_functions) LOOP
    SELECT EXISTS (
      SELECT 1 FROM pg_proc p
      JOIN pg_namespace n ON p.pronamespace = n.oid
      WHERE n.nspname = 'public' AND p.proname = func_name
    ) INTO function_exists;
    
    IF NOT function_exists THEN
      RAISE EXCEPTION 'FAIL: Function % does not exist', func_name;
    END IF;
    
    RAISE NOTICE 'PASS: Function % exists', func_name;
  END LOOP;
  
  RAISE NOTICE '✅ ALL FUNCTIONS VALIDATED SUCCESSFULLY';
END $$;

-- ============================================================================
-- 🧪 4. FUNCTIONAL TESTING (with test data)
-- ============================================================================

DO $$
DECLARE
  test_user1_id uuid;
  test_user2_id uuid;
  test_project_id uuid;
  test_task_id uuid;
  direct_chat_id uuid;
  direct_chat_id2 uuid;
  project_chat_id uuid;
  participant_count integer;
  message_count integer;
  room_count integer;
BEGIN
  RAISE NOTICE '=== FUNCTIONAL TESTING ===';
  
  -- Create test users (if they don't exist)
  INSERT INTO auth.users (id, email, email_confirmed_at, created_at, updated_at)
  VALUES 
    (gen_random_uuid(), 'test_client@example.com', now(), now(), now()),
    (gen_random_uuid(), 'test_worker@example.com', now(), now(), now())
  ON CONFLICT (email) DO NOTHING;
  
  -- Get test user IDs
  SELECT id INTO test_user1_id FROM auth.users WHERE email = 'test_client@example.com';
  SELECT id INTO test_user2_id FROM auth.users WHERE email = 'test_worker@example.com';
  
  -- Create test user profiles
  INSERT INTO users (id, email, name, role, rating, wallet_balance, onboarding_completed)
  VALUES 
    (test_user1_id, 'test_client@example.com', 'Test Client', 'client', 4.5, 1000, true),
    (test_user2_id, 'test_worker@example.com', 'Test Worker', 'worker', 4.8, 500, true)
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    name = EXCLUDED.name,
    role = EXCLUDED.role;
  
  -- Test 1: create_direct_chat function
  RAISE NOTICE 'Testing create_direct_chat function...';
  
  SELECT create_direct_chat(test_user1_id, test_user2_id) INTO direct_chat_id;
  
  IF direct_chat_id IS NULL THEN
    RAISE EXCEPTION 'FAIL: create_direct_chat returned NULL';
  END IF;
  
  -- Test that calling it again returns the same room
  SELECT create_direct_chat(test_user1_id, test_user2_id) INTO direct_chat_id2;
  
  IF direct_chat_id != direct_chat_id2 THEN
    RAISE EXCEPTION 'FAIL: create_direct_chat should return same room for same users';
  END IF;
  
  RAISE NOTICE 'PASS: create_direct_chat works correctly';
  
  -- Verify participants were added
  SELECT COUNT(*) INTO participant_count
  FROM chat_participants 
  WHERE chat_room_id = direct_chat_id;
  
  IF participant_count != 2 THEN
    RAISE EXCEPTION 'FAIL: Direct chat should have exactly 2 participants, found %', participant_count;
  END IF;
  
  RAISE NOTICE 'PASS: Direct chat has correct number of participants';
  
  -- Test 2: Create test project and task
  INSERT INTO projects (id, client_id, title, description, budget, requirements_form, status)
  VALUES (gen_random_uuid(), test_user1_id, 'Test Project', 'Test Description', 1000, 'open')
  RETURNING id INTO test_project_id;
  
  -- Test 3: create_project_chat function
  RAISE NOTICE 'Testing create_project_chat function...';
  
  SELECT create_project_chat(test_project_id, test_user1_id) INTO project_chat_id;
  
  IF project_chat_id IS NULL THEN
    RAISE EXCEPTION 'FAIL: create_project_chat returned NULL';
  END IF;
  
  RAISE NOTICE 'PASS: create_project_chat works correctly';
  
  -- Test 4: add_user_to_chat function
  RAISE NOTICE 'Testing add_user_to_chat function...';
  
  IF NOT add_user_to_chat(project_chat_id, test_user2_id) THEN
    RAISE EXCEPTION 'FAIL: add_user_to_chat returned false';
  END IF;
  
  -- Verify user was added
  SELECT COUNT(*) INTO participant_count
  FROM chat_participants 
  WHERE chat_room_id = project_chat_id AND user_id = test_user2_id;
  
  IF participant_count != 1 THEN
    RAISE EXCEPTION 'FAIL: User was not added to project chat';
  END IF;
  
  RAISE NOTICE 'PASS: add_user_to_chat works correctly';
  
  -- Test 5: Test that adding same user again returns false (no duplicates)
  IF add_user_to_chat(project_chat_id, test_user2_id) THEN
    RAISE EXCEPTION 'FAIL: add_user_to_chat should return false for duplicate user';
  END IF;
  
  RAISE NOTICE 'PASS: add_user_to_chat prevents duplicates';
  
  -- Test 6: Create task and test handle_task_assignment
  INSERT INTO tasks (id, project_id, title, description, weight, payout, assignee_id, status)
  VALUES (gen_random_uuid(), test_project_id, 'Test Task', 'Test Task Description', 5, 100, test_user2_id, 'assigned')
  RETURNING id INTO test_task_id;
  
  -- The trigger should have automatically called handle_task_assignment
  -- Check if a welcome message was created
  SELECT COUNT(*) INTO message_count
  FROM chat_messages 
  WHERE chat_room_id = direct_chat_id 
    AND sender_id = test_user1_id 
    AND message LIKE '%Test Task%';
  
  IF message_count = 0 THEN
    RAISE EXCEPTION 'FAIL: Task assignment trigger did not create welcome message';
  END IF;
  
  RAISE NOTICE 'PASS: Task assignment trigger works correctly';
  
  -- Test 7: Verify room counts
  SELECT COUNT(*) INTO room_count FROM chat_rooms;
  
  IF room_count < 2 THEN
    RAISE EXCEPTION 'FAIL: Expected at least 2 chat rooms (direct + project), found %', room_count;
  END IF;
  
  RAISE NOTICE 'PASS: Chat rooms created successfully';
  
  -- Cleanup test data
  DELETE FROM chat_messages WHERE chat_room_id IN (direct_chat_id, project_chat_id);
  DELETE FROM chat_participants WHERE chat_room_id IN (direct_chat_id, project_chat_id);
  DELETE FROM chat_rooms WHERE id IN (direct_chat_id, project_chat_id);
  DELETE FROM tasks WHERE id = test_task_id;
  DELETE FROM projects WHERE id = test_project_id;
  DELETE FROM users WHERE id IN (test_user1_id, test_user2_id);
  DELETE FROM auth.users WHERE id IN (test_user1_id, test_user2_id);
  
  RAISE NOTICE '✅ ALL FUNCTIONAL TESTS PASSED SUCCESSFULLY';
END $$;

-- ============================================================================
-- 🔄 5. TRIGGER VALIDATION
-- ============================================================================

DO $$
DECLARE
  trigger_exists boolean;
  expected_triggers text[] := ARRAY[
    'task_assignment_chat_trigger',
    'project_creation_chat_trigger'
  ];
  trigger_name text;
BEGIN
  RAISE NOTICE '=== VALIDATING TRIGGERS ===';
  
  FOR trigger_name IN SELECT unnest(expected_triggers) LOOP
    SELECT EXISTS (
      SELECT 1 FROM pg_trigger t
      JOIN pg_class c ON t.tgrelid = c.oid
      JOIN pg_namespace n ON c.relnamespace = n.oid
      WHERE n.nspname = 'public' AND t.tgname = trigger_name
    ) INTO trigger_exists;
    
    IF NOT trigger_exists THEN
      RAISE EXCEPTION 'FAIL: Trigger % does not exist', trigger_name;
    END IF;
    
    RAISE NOTICE 'PASS: Trigger % exists', trigger_name;
  END LOOP;
  
  RAISE NOTICE '✅ ALL TRIGGERS VALIDATED SUCCESSFULLY';
END $$;

-- ============================================================================
-- 📊 6. PERFORMANCE INDEX VALIDATION
-- ============================================================================

DO $$
DECLARE
  index_exists boolean;
  expected_indexes text[] := ARRAY[
    'idx_chat_participants_user_id',
    'idx_chat_participants_chat_room_id',
    'idx_chat_messages_chat_room_id',
    'idx_chat_messages_sender_id',
    'idx_chat_messages_sent_at',
    'idx_chat_rooms_project_id',
    'idx_chat_rooms_is_group'
  ];
  index_name text;
BEGIN
  RAISE NOTICE '=== VALIDATING PERFORMANCE INDEXES ===';
  
  FOR index_name IN SELECT unnest(expected_indexes) LOOP
    SELECT EXISTS (
      SELECT 1 FROM pg_indexes 
      WHERE schemaname = 'public' AND indexname = index_name
    ) INTO index_exists;
    
    IF NOT index_exists THEN
      RAISE EXCEPTION 'FAIL: Index % does not exist', index_name;
    END IF;
    
    RAISE NOTICE 'PASS: Index % exists', index_name;
  END LOOP;
  
  RAISE NOTICE '✅ ALL PERFORMANCE INDEXES VALIDATED SUCCESSFULLY';
END $$;

-- ============================================================================
-- 🎉 FINAL VALIDATION SUMMARY
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '🎉 ===============================================';
  RAISE NOTICE '🎉 CHAT SYSTEM VALIDATION COMPLETED SUCCESSFULLY';
  RAISE NOTICE '🎉 ===============================================';
  RAISE NOTICE '';
  RAISE NOTICE '✅ Tables & Columns: PASS';
  RAISE NOTICE '✅ Row-Level Security: PASS';
  RAISE NOTICE '✅ Functions: PASS';
  RAISE NOTICE '✅ Triggers: PASS';
  RAISE NOTICE '✅ Performance Indexes: PASS';
  RAISE NOTICE '✅ Functional Tests: PASS';
  RAISE NOTICE '';
  RAISE NOTICE 'Your chat system is ready for production use!';
  RAISE NOTICE '';
END $$;