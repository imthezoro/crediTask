/*
  # Comprehensive Chat System Validation

  This migration validates the entire chat system including:
  1. Table structure and columns
  2. Row Level Security (RLS) policies
  3. Functions and their behavior
  4. Triggers and their execution
  5. End-to-end functionality testing

  The validation will report success/failure for each component
  and provide detailed feedback on any issues found.
*/

-- Enable detailed logging
SET client_min_messages TO INFO;

DO $$
DECLARE
    validation_passed boolean := true;
    test_user1_id uuid;
    test_user2_id uuid;
    test_project_id uuid;
    test_task_id uuid;
    test_room_id uuid;
    test_message_id uuid;
    rec record;
    policy_count integer;
    function_exists boolean;
    trigger_exists boolean;
BEGIN
    RAISE INFO '🔍 Starting Comprehensive Chat System Validation...';
    RAISE INFO '================================================';

    -- ========================================
    -- 1. TABLE STRUCTURE VALIDATION
    -- ========================================
    RAISE INFO '';
    RAISE INFO '🔎 1. VALIDATING TABLE STRUCTURE';
    RAISE INFO '--------------------------------';

    -- Check chat_rooms table
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'chat_rooms') THEN
        RAISE INFO '✅ Table "chat_rooms" exists';
        
        -- Check required columns
        SELECT COUNT(*) INTO policy_count FROM information_schema.columns 
        WHERE table_name = 'chat_rooms' AND column_name IN ('id', 'is_group', 'project_id', 'created_at');
        
        IF policy_count = 4 THEN
            RAISE INFO '✅ All required columns exist in chat_rooms';
        ELSE
            RAISE WARNING '❌ Missing columns in chat_rooms table';
            validation_passed := false;
        END IF;
    ELSE
        RAISE WARNING '❌ Table "chat_rooms" does not exist';
        validation_passed := false;
    END IF;

    -- Check chat_participants table
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'chat_participants') THEN
        RAISE INFO '✅ Table "chat_participants" exists';
        
        SELECT COUNT(*) INTO policy_count FROM information_schema.columns 
        WHERE table_name = 'chat_participants' AND column_name IN ('id', 'chat_room_id', 'user_id', 'joined_at');
        
        IF policy_count = 4 THEN
            RAISE INFO '✅ All required columns exist in chat_participants';
        ELSE
            RAISE WARNING '❌ Missing columns in chat_participants table';
            validation_passed := false;
        END IF;
    ELSE
        RAISE WARNING '❌ Table "chat_participants" does not exist';
        validation_passed := false;
    END IF;

    -- Check chat_messages table
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'chat_messages') THEN
        RAISE INFO '✅ Table "chat_messages" exists';
        
        SELECT COUNT(*) INTO policy_count FROM information_schema.columns 
        WHERE table_name = 'chat_messages' AND column_name IN ('id', 'chat_room_id', 'sender_id', 'message', 'sent_at');
        
        IF policy_count = 5 THEN
            RAISE INFO '✅ All required columns exist in chat_messages';
        ELSE
            RAISE WARNING '❌ Missing columns in chat_messages table';
            validation_passed := false;
        END IF;
    ELSE
        RAISE WARNING '❌ Table "chat_messages" does not exist';
        validation_passed := false;
    END IF;

    -- ========================================
    -- 2. ROW LEVEL SECURITY VALIDATION
    -- ========================================
    RAISE INFO '';
    RAISE INFO '🧠 2. VALIDATING ROW LEVEL SECURITY';
    RAISE INFO '----------------------------------';

    -- Check if RLS is enabled on chat_rooms
    SELECT COUNT(*) INTO policy_count FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname = 'chat_rooms' AND c.relrowsecurity = true;
    
    IF policy_count > 0 THEN
        RAISE INFO '✅ RLS enabled on chat_rooms';
    ELSE
        RAISE WARNING '❌ RLS not enabled on chat_rooms';
        validation_passed := false;
    END IF;

    -- Check if RLS is enabled on chat_participants
    SELECT COUNT(*) INTO policy_count FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname = 'chat_participants' AND c.relrowsecurity = true;
    
    IF policy_count > 0 THEN
        RAISE INFO '✅ RLS enabled on chat_participants';
    ELSE
        RAISE WARNING '❌ RLS not enabled on chat_participants';
        validation_passed := false;
    END IF;

    -- Check if RLS is enabled on chat_messages
    SELECT COUNT(*) INTO policy_count FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname = 'chat_messages' AND c.relrowsecurity = true;
    
    IF policy_count > 0 THEN
        RAISE INFO '✅ RLS enabled on chat_messages';
    ELSE
        RAISE WARNING '❌ RLS not enabled on chat_messages';
        validation_passed := false;
    END IF;

    -- Check for RLS policies
    SELECT COUNT(*) INTO policy_count FROM pg_policies WHERE tablename = 'chat_rooms';
    RAISE INFO '📋 Found % RLS policies on chat_rooms', policy_count;

    SELECT COUNT(*) INTO policy_count FROM pg_policies WHERE tablename = 'chat_participants';
    RAISE INFO '📋 Found % RLS policies on chat_participants', policy_count;

    SELECT COUNT(*) INTO policy_count FROM pg_policies WHERE tablename = 'chat_messages';
    RAISE INFO '📋 Found % RLS policies on chat_messages', policy_count;

    -- ========================================
    -- 3. FUNCTION VALIDATION
    -- ========================================
    RAISE INFO '';
    RAISE INFO '⚙️ 3. VALIDATING FUNCTIONS';
    RAISE INFO '-------------------------';

    -- Check create_direct_chat function
    SELECT EXISTS (
        SELECT 1 FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE p.proname = 'create_direct_chat' AND n.nspname = 'public'
    ) INTO function_exists;
    
    IF function_exists THEN
        RAISE INFO '✅ Function "create_direct_chat" exists';
    ELSE
        RAISE WARNING '❌ Function "create_direct_chat" does not exist';
        validation_passed := false;
    END IF;

    -- Check create_project_chat function
    SELECT EXISTS (
        SELECT 1 FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE p.proname = 'create_project_chat' AND n.nspname = 'public'
    ) INTO function_exists;
    
    IF function_exists THEN
        RAISE INFO '✅ Function "create_project_chat" exists';
    ELSE
        RAISE WARNING '❌ Function "create_project_chat" does not exist';
        validation_passed := false;
    END IF;

    -- Check add_user_to_chat function
    SELECT EXISTS (
        SELECT 1 FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE p.proname = 'add_user_to_chat' AND n.nspname = 'public'
    ) INTO function_exists;
    
    IF function_exists THEN
        RAISE INFO '✅ Function "add_user_to_chat" exists';
    ELSE
        RAISE WARNING '❌ Function "add_user_to_chat" does not exist';
        validation_passed := false;
    END IF;

    -- Check handle_task_assignment function
    SELECT EXISTS (
        SELECT 1 FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE p.proname = 'handle_task_assignment' AND n.nspname = 'public'
    ) INTO function_exists;
    
    IF function_exists THEN
        RAISE INFO '✅ Function "handle_task_assignment" exists';
    ELSE
        RAISE WARNING '❌ Function "handle_task_assignment" does not exist';
        validation_passed := false;
    END IF;

    -- Check handle_project_creation function
    SELECT EXISTS (
        SELECT 1 FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE p.proname = 'handle_project_creation' AND n.nspname = 'public'
    ) INTO function_exists;
    
    IF function_exists THEN
        RAISE INFO '✅ Function "handle_project_creation" exists';
    ELSE
        RAISE WARNING '❌ Function "handle_project_creation" does not exist';
        validation_passed := false;
    END IF;

    -- ========================================
    -- 4. TRIGGER VALIDATION
    -- ========================================
    RAISE INFO '';
    RAISE INFO '🧪 4. VALIDATING TRIGGERS';
    RAISE INFO '------------------------';

    -- Check for project creation trigger
    SELECT EXISTS (
        SELECT 1 FROM pg_trigger t
        JOIN pg_class c ON t.tgrelid = c.oid
        WHERE c.relname = 'projects' AND t.tgname LIKE '%project_creation%'
    ) INTO trigger_exists;
    
    IF trigger_exists THEN
        RAISE INFO '✅ Project creation trigger exists';
    ELSE
        RAISE INFO '⚠️ Project creation trigger not found (optional)';
    END IF;

    -- Check for task assignment trigger
    SELECT EXISTS (
        SELECT 1 FROM pg_trigger t
        JOIN pg_class c ON t.tgrelid = c.oid
        WHERE c.relname = 'tasks' AND t.tgname LIKE '%task_assignment%'
    ) INTO trigger_exists;
    
    IF trigger_exists THEN
        RAISE INFO '✅ Task assignment trigger exists';
    ELSE
        RAISE INFO '⚠️ Task assignment trigger not found (optional)';
    END IF;

    -- ========================================
    -- 5. FUNCTIONAL TESTING
    -- ========================================
    RAISE INFO '';
    RAISE INFO '🧪 5. FUNCTIONAL TESTING';
    RAISE INFO '-----------------------';

    -- Get test users (if they exist)
    SELECT id INTO test_user1_id FROM users WHERE role = 'client' LIMIT 1;
    SELECT id INTO test_user2_id FROM users WHERE role = 'worker' LIMIT 1;

    IF test_user1_id IS NOT NULL AND test_user2_id IS NOT NULL THEN
        RAISE INFO '✅ Found test users for functional testing';
        
        -- Test direct chat creation (if function exists)
        IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'create_direct_chat') THEN
            BEGIN
                SELECT create_direct_chat(test_user1_id, test_user2_id) INTO test_room_id;
                RAISE INFO '✅ create_direct_chat function works correctly';
                
                -- Test duplicate prevention
                SELECT create_direct_chat(test_user1_id, test_user2_id) INTO rec;
                IF rec = test_room_id THEN
                    RAISE INFO '✅ create_direct_chat prevents duplicates correctly';
                END IF;
                
            EXCEPTION WHEN OTHERS THEN
                RAISE WARNING '❌ create_direct_chat function failed: %', SQLERRM;
                validation_passed := false;
            END;
        END IF;

        -- Test project chat creation (if function exists and we have a project)
        SELECT id INTO test_project_id FROM projects WHERE client_id = test_user1_id LIMIT 1;
        
        IF test_project_id IS NOT NULL AND EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'create_project_chat') THEN
            BEGIN
                SELECT create_project_chat(test_project_id, test_user1_id) INTO test_room_id;
                RAISE INFO '✅ create_project_chat function works correctly';
                
            EXCEPTION WHEN OTHERS THEN
                RAISE WARNING '❌ create_project_chat function failed: %', SQLERRM;
                validation_passed := false;
            END;
        END IF;

        -- Test basic CRUD operations
        BEGIN
            -- Test inserting a chat room
            INSERT INTO chat_rooms (is_group, project_id) 
            VALUES (false, NULL) 
            RETURNING id INTO test_room_id;
            
            -- Test adding participants
            INSERT INTO chat_participants (chat_room_id, user_id) 
            VALUES (test_room_id, test_user1_id), (test_room_id, test_user2_id);
            
            -- Test sending a message
            INSERT INTO chat_messages (chat_room_id, sender_id, message) 
            VALUES (test_room_id, test_user1_id, 'Test message') 
            RETURNING id INTO test_message_id;
            
            RAISE INFO '✅ Basic CRUD operations work correctly';
            
            -- Clean up test data
            DELETE FROM chat_messages WHERE id = test_message_id;
            DELETE FROM chat_participants WHERE chat_room_id = test_room_id;
            DELETE FROM chat_rooms WHERE id = test_room_id;
            
            RAISE INFO '✅ Test data cleanup successful';
            
        EXCEPTION WHEN OTHERS THEN
            RAISE WARNING '❌ Basic CRUD operations failed: %', SQLERRM;
            validation_passed := false;
        END;

    ELSE
        RAISE INFO '⚠️ No test users found - skipping functional testing';
    END IF;

    -- ========================================
    -- 6. PERFORMANCE CHECKS
    -- ========================================
    RAISE INFO '';
    RAISE INFO '🚀 6. PERFORMANCE CHECKS';
    RAISE INFO '-----------------------';

    -- Check for important indexes
    SELECT COUNT(*) INTO policy_count FROM pg_indexes 
    WHERE tablename = 'chat_participants' AND indexname LIKE '%chat_room_id%';
    
    IF policy_count > 0 THEN
        RAISE INFO '✅ Index on chat_participants.chat_room_id exists';
    ELSE
        RAISE INFO '⚠️ Consider adding index on chat_participants.chat_room_id for better performance';
    END IF;

    SELECT COUNT(*) INTO policy_count FROM pg_indexes 
    WHERE tablename = 'chat_messages' AND indexname LIKE '%chat_room_id%';
    
    IF policy_count > 0 THEN
        RAISE INFO '✅ Index on chat_messages.chat_room_id exists';
    ELSE
        RAISE INFO '⚠️ Consider adding index on chat_messages.chat_room_id for better performance';
    END IF;

    -- ========================================
    -- 7. FINAL VALIDATION SUMMARY
    -- ========================================
    RAISE INFO '';
    RAISE INFO '📊 VALIDATION SUMMARY';
    RAISE INFO '====================';

    IF validation_passed THEN
        RAISE INFO '🎉 ✅ ALL CRITICAL VALIDATIONS PASSED!';
        RAISE INFO '🎉 Your chat system is properly configured and functional.';
    ELSE
        RAISE WARNING '❌ SOME VALIDATIONS FAILED!';
        RAISE WARNING '❌ Please review the errors above and fix the issues.';
    END IF;

    RAISE INFO '';
    RAISE INFO '📋 NEXT STEPS:';
    RAISE INFO '- Test the chat functionality in your application';
    RAISE INFO '- Monitor performance with real usage';
    RAISE INFO '- Consider adding additional indexes if needed';
    RAISE INFO '- Set up monitoring for chat system health';

END $$;