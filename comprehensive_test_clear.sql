-- ============================================================================
-- COMPREHENSIVE TEST CLEAR SCRIPT
-- ============================================================================
-- This script clears ALL records for thorough testing while preserving
-- the current user's profile and authentication data

-- WARNING: This will permanently delete all data except the current user
-- Make sure you have backups if needed before running this script

-- ============================================================================
-- STEP 1: GET CURRENT USER ID (to preserve)
-- ============================================================================

DO $$
DECLARE
    v_current_user_id UUID;
BEGIN
    -- Get the current user ID from auth.users
    SELECT id INTO v_current_user_id 
    FROM auth.users 
    WHERE email = current_setting('request.jwt.claims', true)::json->>'email'
    LIMIT 1;
    
    -- Store it in a temporary variable for later use
    PERFORM set_config('app.current_user_id', v_current_user_id::text, false);
    
    RAISE NOTICE 'Current user ID: %', v_current_user_id;
END $$;

-- ============================================================================
-- STEP 2: CLEAR EVENT SYSTEM DATA
-- ============================================================================

-- Clear event responses
DELETE FROM public.event_responses;

-- Clear event notifications
DELETE FROM public.event_notifications;

-- Reset sequences for event tables
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.sequences WHERE sequence_name = 'event_responses_id_seq') THEN
        ALTER SEQUENCE public.event_responses_id_seq RESTART WITH 1;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.sequences WHERE sequence_name = 'event_notifications_id_seq') THEN
        ALTER SEQUENCE public.event_notifications_id_seq RESTART WITH 1;
    END IF;
END $$;

-- ============================================================================
-- STEP 3: CLEAR SCHEDULING DATA
-- ============================================================================

-- Clear scheduled care blocks
DELETE FROM public.scheduled_care;

-- Clear care requests
DELETE FROM public.care_requests;

-- Clear care responses
DELETE FROM public.care_responses;

-- Reset sequences for scheduling tables
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.sequences WHERE sequence_name = 'scheduled_care_id_seq') THEN
        ALTER SEQUENCE public.scheduled_care_id_seq RESTART WITH 1;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.sequences WHERE sequence_name = 'care_requests_id_seq') THEN
        ALTER SEQUENCE public.care_requests_id_seq RESTART WITH 1;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.sequences WHERE sequence_name = 'care_responses_id_seq') THEN
        ALTER SEQUENCE public.care_responses_id_seq RESTART WITH 1;
    END IF;
END $$;

-- ============================================================================
-- STEP 4: CLEAR COMMUNICATION DATA
-- ============================================================================

-- Clear chat messages
DELETE FROM public.chat_messages;

-- Reset sequence for chat messages
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.sequences WHERE sequence_name = 'chat_messages_id_seq') THEN
        ALTER SEQUENCE public.chat_messages_id_seq RESTART WITH 1;
    END IF;
END $$;

-- ============================================================================
-- STEP 5: CLEAR GROUP DATA (IN CORRECT ORDER)
-- ============================================================================

-- Clear child_group_members FIRST (child of groups)
DELETE FROM public.child_group_members;

-- Clear group memberships
DELETE FROM public.group_members;

-- Clear groups (but preserve the current user's groups if any)
DELETE FROM public.groups 
WHERE id NOT IN (
    SELECT DISTINCT gm.group_id 
    FROM group_members gm 
    WHERE gm.profile_id = (SELECT current_setting('app.current_user_id', true)::UUID)
);

-- Reset sequences for group tables
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.sequences WHERE sequence_name = 'child_group_members_id_seq') THEN
        ALTER SEQUENCE public.child_group_members_id_seq RESTART WITH 1;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.sequences WHERE sequence_name = 'group_members_id_seq') THEN
        ALTER SEQUENCE public.group_members_id_seq RESTART WITH 1;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.sequences WHERE sequence_name = 'groups_id_seq') THEN
        ALTER SEQUENCE public.groups_id_seq RESTART WITH 1;
    END IF;
END $$;

-- ============================================================================
-- STEP 6: CLEAR CHILDREN DATA
-- ============================================================================

-- Clear children (but preserve the current user's children if any)
DELETE FROM public.children 
WHERE parent_id NOT IN (
    SELECT current_setting('app.current_user_id', true)::UUID
);

-- Reset sequence for children
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.sequences WHERE sequence_name = 'children_id_seq') THEN
        ALTER SEQUENCE public.children_id_seq RESTART WITH 1;
    END IF;
END $$;

-- ============================================================================
-- STEP 7: CLEAR OLD/BACKUP TABLES (if they exist)
-- ============================================================================

-- Clear old scheduling tables (if they exist)
DO $$
DECLARE
    v_table_name TEXT;
BEGIN
    FOR v_table_name IN 
        SELECT unnest(ARRAY[
            'babysitting_requests',
            'block_connections',
            'group_invitations',
            'invitation_time_blocks',
            'request_responses',
            'scheduled_blocks'
        ])
    LOOP
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = v_table_name AND table_schema = 'public') THEN
            EXECUTE 'DELETE FROM public.' || v_table_name;
            RAISE NOTICE '✅ Cleared old table: %', v_table_name;
        END IF;
    END LOOP;
END $$;

-- ============================================================================
-- STEP 8: VERIFICATION QUERY
-- ============================================================================

-- Show final record counts
SELECT 'Final Record Counts:' as info;
SELECT 
    'Profiles' as table_name,
    COUNT(*) as record_count
FROM public.profiles
UNION ALL
SELECT 
    'Groups' as table_name,
    COUNT(*) as record_count
FROM public.groups
UNION ALL
SELECT 
    'Group Members' as table_name,
    COUNT(*) as record_count
FROM public.group_members
UNION ALL
SELECT 
    'Child Group Members' as table_name,
    COUNT(*) as record_count
FROM public.child_group_members
UNION ALL
SELECT 
    'Children' as table_name,
    COUNT(*) as record_count
FROM public.children
UNION ALL
SELECT 
    'Care Requests' as table_name,
    COUNT(*) as record_count
FROM public.care_requests
UNION ALL
SELECT 
    'Scheduled Care' as table_name,
    COUNT(*) as record_count
FROM public.scheduled_care
UNION ALL
SELECT 
    'Care Responses' as table_name,
    COUNT(*) as record_count
FROM public.care_responses
UNION ALL
SELECT 
    'Event Responses' as table_name,
    COUNT(*) as record_count
FROM public.event_responses
UNION ALL
SELECT 
    'Event Notifications' as table_name,
    COUNT(*) as record_count
FROM public.event_notifications
UNION ALL
SELECT 
    'Chat Messages' as table_name,
    COUNT(*) as record_count
FROM public.chat_messages;

-- ============================================================================
-- STEP 9: SUCCESS MESSAGE
-- ============================================================================

-- This query will show success message if everything worked
SELECT 
    CASE 
        WHEN (SELECT COUNT(*) FROM public.care_requests) = 0 
         AND (SELECT COUNT(*) FROM public.scheduled_care) = 0
         AND (SELECT COUNT(*) FROM public.care_responses) = 0
         AND (SELECT COUNT(*) FROM public.event_responses) = 0
         AND (SELECT COUNT(*) FROM public.event_notifications) = 0
         AND (SELECT COUNT(*) FROM public.chat_messages) = 0
         AND (SELECT COUNT(*) FROM public.group_members) = 0
         AND (SELECT COUNT(*) FROM public.child_group_members) = 0
         AND (SELECT COUNT(*) FROM public.children) = 0
         AND (SELECT COUNT(*) FROM public.groups) = 0
        THEN '✅ All test data cleared successfully! Ready for thorough testing!'
        ELSE '❌ Some data may still exist - check the counts above'
    END as status;

-- ============================================================================
-- STEP 10: TESTING CHECKLIST
-- ============================================================================

SELECT 'Testing Checklist:' as info;
SELECT '1. Create a new profile' as step
UNION ALL
SELECT '2. Create a new group' as step
UNION ALL
SELECT '3. Add children to your profile' as step
UNION ALL
SELECT '4. Invite members to your group' as step
UNION ALL
SELECT '5. Create care requests' as step
UNION ALL
SELECT '6. Create group events' as step
UNION ALL
SELECT '7. Test RSVP functionality' as step
UNION ALL
SELECT '8. Test scheduling system' as step
UNION ALL
SELECT '9. Test chat messaging' as step
UNION ALL
SELECT '10. Test notifications' as step;

-- ============================================================================
-- COMPLETION
-- ============================================================================

SELECT '🎉 Database is now clean and ready for comprehensive testing!' as completion_message; 