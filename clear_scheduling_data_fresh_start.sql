-- Clear All Scheduling Data for Fresh Start
-- This script safely clears all scheduling-related records while preserving fundamental app data
-- Run this in your Supabase SQL editor

-- ============================================================================
-- STEP 1: Verify what we're clearing (for safety)
-- ============================================================================

-- Show current scheduling data counts
SELECT 
    'Current Data Counts' as info,
    (SELECT COUNT(*) FROM public.scheduled_blocks) as scheduled_blocks_count,
    (SELECT COUNT(*) FROM public.babysitting_requests) as babysitting_requests_count,
    (SELECT COUNT(*) FROM public.request_responses) as request_responses_count,
    (SELECT COUNT(*) FROM public.group_invitations) as group_invitations_count,
    (SELECT COUNT(*) FROM public.invitation_time_blocks) as invitation_time_blocks_count,
    (SELECT COUNT(*) FROM public.block_connections) as block_connections_count;

-- ============================================================================
-- STEP 2: Clear all scheduling-related data in correct order (respecting foreign keys)
-- ============================================================================

-- Clear block connections first (they reference scheduled_blocks)
DELETE FROM public.block_connections;

-- Clear scheduled blocks (calendar events)
DELETE FROM public.scheduled_blocks;

-- Clear request responses
DELETE FROM public.request_responses;

-- Clear babysitting requests
DELETE FROM public.babysitting_requests;

-- Clear group invitations
DELETE FROM public.group_invitations;

-- Clear invitation time blocks
DELETE FROM public.invitation_time_blocks;

-- ============================================================================
-- STEP 3: Verify fundamental data is preserved
-- ============================================================================

-- Show preserved data counts
SELECT 
    'Preserved Data Counts' as info,
    (SELECT COUNT(*) FROM public.profiles) as profiles_count,
    (SELECT COUNT(*) FROM public.groups) as groups_count,
    (SELECT COUNT(*) FROM public.children) as children_count,
    (SELECT COUNT(*) FROM public.group_members) as group_members_count,
    (SELECT COUNT(*) FROM public.child_group_members) as child_group_members_count,
    (SELECT COUNT(*) FROM public.messages) as messages_count;

-- ============================================================================
-- STEP 4: Verify scheduling data is cleared
-- ============================================================================

-- Show cleared data counts (should all be 0)
SELECT 
    'Cleared Data Counts (should be 0)' as info,
    (SELECT COUNT(*) FROM public.scheduled_blocks) as scheduled_blocks_count,
    (SELECT COUNT(*) FROM public.babysitting_requests) as babysitting_requests_count,
    (SELECT COUNT(*) FROM public.request_responses) as request_responses_count,
    (SELECT COUNT(*) FROM public.group_invitations) as group_invitations_count,
    (SELECT COUNT(*) FROM public.invitation_time_blocks) as invitation_time_blocks_count,
    (SELECT COUNT(*) FROM public.block_connections) as block_connections_count;

-- ============================================================================
-- STEP 5: Verify functions still exist
-- ============================================================================

-- Check that key functions still exist
SELECT 
    'Function Verification' as info,
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_name = 'create_care_exchange') 
        THEN '✅ create_care_exchange exists'
        ELSE '❌ create_care_exchange missing'
    END as create_care_exchange_status,
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_name = 'invite_specific_parents_to_care') 
        THEN '✅ invite_specific_parents_to_care exists'
        ELSE '❌ invite_specific_parents_to_care missing'
    END as invite_function_status,
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_name = 'accept_group_invitation_with_time_block') 
        THEN '✅ accept_group_invitation_with_time_block exists'
        ELSE '❌ accept_group_invitation_with_time_block missing'
    END as accept_function_status,
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_name = 'get_available_time_blocks_for_invitation') 
        THEN '✅ get_available_time_blocks_for_invitation exists'
        ELSE '❌ get_available_time_blocks_for_invitation missing'
    END as get_blocks_function_status,
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_name = 'get_user_children_for_group') 
        THEN '✅ get_user_children_for_group exists'
        ELSE '❌ get_user_children_for_group missing'
    END as get_children_function_status;

-- ============================================================================
-- STEP 6: Verify table structure is intact
-- ============================================================================

-- Check that all scheduling tables still exist and have correct structure
SELECT 
    'Table Structure Verification' as info,
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'scheduled_blocks') 
        THEN '✅ scheduled_blocks table exists'
        ELSE '❌ scheduled_blocks table missing'
    END as scheduled_blocks_status,
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'babysitting_requests') 
        THEN '✅ babysitting_requests table exists'
        ELSE '❌ babysitting_requests table missing'
    END as babysitting_requests_status,
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'request_responses') 
        THEN '✅ request_responses table exists'
        ELSE '❌ request_responses table missing'
    END as request_responses_status,
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'group_invitations') 
        THEN '✅ group_invitations table exists'
        ELSE '❌ group_invitations table missing'
    END as group_invitations_status,
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'invitation_time_blocks') 
        THEN '✅ invitation_time_blocks table exists'
        ELSE '❌ invitation_time_blocks table missing'
    END as invitation_time_blocks_status;

-- ============================================================================
-- STEP 7: Success message
-- ============================================================================

SELECT '🎉 SUCCESS: All scheduling data has been cleared! You can now start fresh testing.' as status;

-- ============================================================================
-- STEP 8: Next steps reminder
-- ============================================================================

SELECT '📋 Next Steps:' as reminder,
       '1. Test Parent A ↔ Parent B initial request/response flow' as step1,
       '2. Test Parent A accepting Parent B response' as step2,
       '3. Test Parent B inviting others to open time slots' as step3,
       '4. Test Parent C accepting group invitations' as step4; 