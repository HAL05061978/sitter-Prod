-- ============================================================================
-- CLEAR GROUPS, CHATS, MESSAGES, AND SCHEDULING DATA
-- ============================================================================
-- This script clears all data related to groups, chats, messages, and scheduling
-- while preserving profiles, children, and other core data for testing purposes
-- WARNING: This will delete ALL groups, chats, messages, and scheduling records

-- ============================================================================
-- STEP 1: SHOW WHAT WE'RE ABOUT TO DELETE
-- ============================================================================

SELECT 'Current State (before clearing groups/chats/messages/scheduling):' as info;

-- Check and count groups
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'groups') THEN
        PERFORM set_config('app.current_groups_count', (SELECT COUNT(*)::text FROM public.groups), false);
    ELSE
        PERFORM set_config('app.current_groups_count', '0', false);
    END IF;
END $$;

-- Check and count group_members
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'group_members') THEN
        PERFORM set_config('app.current_group_members_count', (SELECT COUNT(*)::text FROM public.group_members), false);
    ELSE
        PERFORM set_config('app.current_group_members_count', '0', false);
    END IF;
END $$;

-- Check and count child_group_members
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'child_group_members') THEN
        PERFORM set_config('app.current_child_group_members_count', (SELECT COUNT(*)::text FROM public.child_group_members), false);
    ELSE
        PERFORM set_config('app.current_child_group_members_count', '0', false);
    END IF;
END $$;

-- Check and count group_invites
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'group_invites') THEN
        PERFORM set_config('app.current_group_invites_count', (SELECT COUNT(*)::text FROM public.group_invites), false);
    ELSE
        PERFORM set_config('app.current_group_invites_count', '0', false);
    END IF;
END $$;

-- Check and count messages
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'messages') THEN
        PERFORM set_config('app.current_messages_count', (SELECT COUNT(*)::text FROM public.messages), false);
    ELSE
        PERFORM set_config('app.current_messages_count', '0', false);
    END IF;
END $$;

-- Check and count babysitting_requests
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'babysitting_requests') THEN
        PERFORM set_config('app.current_babysitting_requests_count', (SELECT COUNT(*)::text FROM public.babysitting_requests), false);
    ELSE
        PERFORM set_config('app.current_babysitting_requests_count', '0', false);
    END IF;
END $$;

-- Check and count request_responses
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'request_responses') THEN
        PERFORM set_config('app.current_request_responses_count', (SELECT COUNT(*)::text FROM public.request_responses), false);
    ELSE
        PERFORM set_config('app.current_request_responses_count', '0', false);
    END IF;
END $$;

-- Check and count scheduled_blocks
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'scheduled_blocks') THEN
        PERFORM set_config('app.current_scheduled_blocks_count', (SELECT COUNT(*)::text FROM public.scheduled_blocks), false);
    ELSE
        PERFORM set_config('app.current_scheduled_blocks_count', '0', false);
    END IF;
END $$;

-- Check and count block_connections
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'block_connections') THEN
        PERFORM set_config('app.current_block_connections_count', (SELECT COUNT(*)::text FROM public.block_connections), false);
    ELSE
        PERFORM set_config('app.current_block_connections_count', '0', false);
    END IF;
END $$;

-- Display the counts
SELECT 'Groups' as table_name, current_setting('app.current_groups_count')::int as count
UNION ALL
SELECT 'Group Members' as table_name, current_setting('app.current_group_members_count')::int as count
UNION ALL
SELECT 'Child Group Members' as table_name, current_setting('app.current_child_group_members_count')::int as count
UNION ALL
SELECT 'Group Invites' as table_name, current_setting('app.current_group_invites_count')::int as count
UNION ALL
SELECT 'Messages' as table_name, current_setting('app.current_messages_count')::int as count
UNION ALL
SELECT 'Babysitting Requests' as table_name, current_setting('app.current_babysitting_requests_count')::int as count
UNION ALL
SELECT 'Request Responses' as table_name, current_setting('app.current_request_responses_count')::int as count
UNION ALL
SELECT 'Scheduled Blocks' as table_name, current_setting('app.current_scheduled_blocks_count')::int as count
UNION ALL
SELECT 'Block Connections' as table_name, current_setting('app.current_block_connections_count')::int as count;

-- ============================================================================
-- STEP 2: CLEAR ALL SCHEDULING DATA (in correct order due to foreign keys)
-- ============================================================================

-- Clear block connections first (they reference scheduled_blocks)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'block_connections') THEN
        DELETE FROM public.block_connections;
        RAISE NOTICE 'Cleared block_connections table';
    ELSE
        RAISE NOTICE 'block_connections table does not exist - skipping';
    END IF;
END $$;

-- Clear scheduled blocks
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'scheduled_blocks') THEN
        DELETE FROM public.scheduled_blocks;
        RAISE NOTICE 'Cleared scheduled_blocks table';
    ELSE
        RAISE NOTICE 'scheduled_blocks table does not exist - skipping';
    END IF;
END $$;

-- Clear request responses (they reference babysitting_requests)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'request_responses') THEN
        DELETE FROM public.request_responses;
        RAISE NOTICE 'Cleared request_responses table';
    ELSE
        RAISE NOTICE 'request_responses table does not exist - skipping';
    END IF;
END $$;

-- Clear babysitting requests
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'babysitting_requests') THEN
        DELETE FROM public.babysitting_requests;
        RAISE NOTICE 'Cleared babysitting_requests table';
    ELSE
        RAISE NOTICE 'babysitting_requests table does not exist - skipping';
    END IF;
END $$;

-- ============================================================================
-- STEP 3: CLEAR ALL MESSAGING DATA
-- ============================================================================

-- Clear messages
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'messages') THEN
        DELETE FROM public.messages;
        RAISE NOTICE 'Cleared messages table';
    ELSE
        RAISE NOTICE 'messages table does not exist - skipping';
    END IF;
END $$;

-- ============================================================================
-- STEP 4: CLEAR ALL GROUP DATA (in correct order due to foreign keys)
-- ============================================================================

-- Clear child group members (they reference groups and children)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'child_group_members') THEN
        DELETE FROM public.child_group_members;
        RAISE NOTICE 'Cleared child_group_members table';
    ELSE
        RAISE NOTICE 'child_group_members table does not exist - skipping';
    END IF;
END $$;

-- Clear group invites (they reference groups)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'group_invites') THEN
        DELETE FROM public.group_invites;
        RAISE NOTICE 'Cleared group_invites table';
    ELSE
        RAISE NOTICE 'group_invites table does not exist - skipping';
    END IF;
END $$;

-- Clear group members (they reference groups and profiles)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'group_members') THEN
        DELETE FROM public.group_members;
        RAISE NOTICE 'Cleared group_members table';
    ELSE
        RAISE NOTICE 'group_members table does not exist - skipping';
    END IF;
END $$;

-- Clear groups (this will cascade to any remaining references)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'groups') THEN
        DELETE FROM public.groups;
        RAISE NOTICE 'Cleared groups table';
    ELSE
        RAISE NOTICE 'groups table does not exist - skipping';
    END IF;
END $$;

-- ============================================================================
-- STEP 5: VERIFICATION - SHOW WHAT REMAINS
-- ============================================================================

SELECT 'Final State (after clearing groups/chats/messages/scheduling):' as info;

-- Show remaining data
SELECT 
    'Profiles' as table_name,
    COUNT(*) as count
FROM public.profiles
UNION ALL
SELECT 
    'Children' as table_name,
    COUNT(*) as count
FROM public.children;

-- Show cleared tables (should all be 0)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'groups') THEN
        RAISE NOTICE 'Groups remaining: %', (SELECT COUNT(*) FROM public.groups);
    ELSE
        RAISE NOTICE 'Groups table does not exist';
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'group_members') THEN
        RAISE NOTICE 'Group Members remaining: %', (SELECT COUNT(*) FROM public.group_members);
    ELSE
        RAISE NOTICE 'Group Members table does not exist';
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'messages') THEN
        RAISE NOTICE 'Messages remaining: %', (SELECT COUNT(*) FROM public.messages);
    ELSE
        RAISE NOTICE 'Messages table does not exist';
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'babysitting_requests') THEN
        RAISE NOTICE 'Babysitting Requests remaining: %', (SELECT COUNT(*) FROM public.babysitting_requests);
    ELSE
        RAISE NOTICE 'Babysitting Requests table does not exist';
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'scheduled_blocks') THEN
        RAISE NOTICE 'Scheduled Blocks remaining: %', (SELECT COUNT(*) FROM public.scheduled_blocks);
    ELSE
        RAISE NOTICE 'Scheduled Blocks table does not exist';
    END IF;
END $$;

-- ============================================================================
-- STEP 6: RESET SEQUENCES (if any exist)
-- ============================================================================

-- Reset any sequences that might exist for these tables
DO $$
BEGIN
    -- Reset groups sequence if it exists
    IF EXISTS (SELECT 1 FROM information_schema.sequences WHERE sequence_name = 'groups_id_seq') THEN
        ALTER SEQUENCE public.groups_id_seq RESTART WITH 1;
        RAISE NOTICE 'Reset groups_id_seq sequence';
    END IF;
    
    -- Reset messages sequence if it exists
    IF EXISTS (SELECT 1 FROM information_schema.sequences WHERE sequence_name = 'messages_id_seq') THEN
        ALTER SEQUENCE public.messages_id_seq RESTART WITH 1;
        RAISE NOTICE 'Reset messages_id_seq sequence';
    END IF;
    
    -- Reset babysitting_requests sequence if it exists
    IF EXISTS (SELECT 1 FROM information_schema.sequences WHERE sequence_name = 'babysitting_requests_id_seq') THEN
        ALTER SEQUENCE public.babysitting_requests_id_seq RESTART WITH 1;
        RAISE NOTICE 'Reset babysitting_requests_id_seq sequence';
    END IF;
    
    -- Reset request_responses sequence if it exists
    IF EXISTS (SELECT 1 FROM information_schema.sequences WHERE sequence_name = 'request_responses_id_seq') THEN
        ALTER SEQUENCE public.request_responses_id_seq RESTART WITH 1;
        RAISE NOTICE 'Reset request_responses_id_seq sequence';
    END IF;
    
    -- Reset scheduled_blocks sequence if it exists
    IF EXISTS (SELECT 1 FROM information_schema.sequences WHERE sequence_name = 'scheduled_blocks_id_seq') THEN
        ALTER SEQUENCE public.scheduled_blocks_id_seq RESTART WITH 1;
        RAISE NOTICE 'Reset scheduled_blocks_id_seq sequence';
    END IF;
    
    -- Reset block_connections sequence if it exists
    IF EXISTS (SELECT 1 FROM information_schema.sequences WHERE sequence_name = 'block_connections_id_seq') THEN
        ALTER SEQUENCE public.block_connections_id_seq RESTART WITH 1;
        RAISE NOTICE 'Reset block_connections_id_seq sequence';
    END IF;
END $$;

-- ============================================================================
-- STEP 7: COMPLETION MESSAGE
-- ============================================================================

SELECT '✅ Groups, chats, messages, and scheduling data cleared successfully!' as status;
SELECT 'Profiles and children data preserved for testing.' as note;
SELECT 'You can now start testing scheduling, new messages/chats, etc. from scratch.' as note;

-- ============================================================================
-- STEP 8: TESTING INSTRUCTIONS
-- ============================================================================

SELECT 'Next Steps for Testing:' as step
UNION ALL
SELECT '1. Create new groups for testing' as step
UNION ALL
SELECT '2. Add members to groups' as step
UNION ALL
SELECT '3. Send messages in groups' as step
UNION ALL
SELECT '4. Create babysitting requests' as step
UNION ALL
SELECT '5. Test scheduling functionality' as step
UNION ALL
SELECT '6. Test all messaging features' as step;

-- ============================================================================
-- COMPLETION
-- ============================================================================

SELECT '🎉 All groups, chats, messages, and scheduling data has been cleared!' as final_status;
SELECT 'Your database is now ready for fresh testing of these features.' as final_note; 