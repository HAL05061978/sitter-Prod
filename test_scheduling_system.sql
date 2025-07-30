-- Test Scheduling System Components
-- This script verifies that all required tables, functions, and workflows are working

-- ============================================================================
-- STEP 1: Test Database Structure
-- ============================================================================

-- Check if care_group_id column exists in scheduled_blocks
SELECT 
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'scheduled_blocks' 
            AND column_name = 'care_group_id'
        ) THEN '✅ PASS: care_group_id column exists in scheduled_blocks'
        ELSE '❌ FAIL: care_group_id column missing from scheduled_blocks'
    END as care_group_id_check;

-- Check if group_invitations table exists
SELECT 
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_name = 'group_invitations'
        ) THEN '✅ PASS: group_invitations table exists'
        ELSE '❌ FAIL: group_invitations table missing'
    END as group_invitations_check;

-- Check if invitation_time_blocks table exists
SELECT 
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_name = 'invitation_time_blocks'
        ) THEN '✅ PASS: invitation_time_blocks table exists'
        ELSE '❌ FAIL: invitation_time_blocks table missing'
    END as invitation_time_blocks_check;

-- ============================================================================
-- STEP 2: Test Required Functions
-- ============================================================================

-- Check if get_available_group_members_for_invitation function exists
SELECT 
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.routines 
            WHERE routine_name = 'get_available_group_members_for_invitation'
        ) THEN '✅ PASS: get_available_group_members_for_invitation function exists'
        ELSE '❌ FAIL: get_available_group_members_for_invitation function missing'
    END as get_available_group_members_check;

-- Check if invite_specific_parents_to_care function exists
SELECT 
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.routines 
            WHERE routine_name = 'invite_specific_parents_to_care'
        ) THEN '✅ PASS: invite_specific_parents_to_care function exists'
        ELSE '❌ FAIL: invite_specific_parents_to_care function missing'
    END as invite_specific_parents_check;

-- Check if get_available_time_blocks_for_invitation function exists
SELECT 
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.routines 
            WHERE routine_name = 'get_available_time_blocks_for_invitation'
        ) THEN '✅ PASS: get_available_time_blocks_for_invitation function exists'
        ELSE '❌ FAIL: get_available_time_blocks_for_invitation function missing'
    END as get_available_time_blocks_check;

-- Check if get_user_children_for_group function exists
SELECT 
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.routines 
            WHERE routine_name = 'get_user_children_for_group'
        ) THEN '✅ PASS: get_user_children_for_group function exists'
        ELSE '❌ FAIL: get_user_children_for_group function missing'
    END as get_user_children_check;

-- Check if accept_group_invitation_with_time_block function exists
SELECT 
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.routines 
            WHERE routine_name = 'accept_group_invitation_with_time_block'
        ) THEN '✅ PASS: accept_group_invitation_with_time_block function exists'
        ELSE '❌ FAIL: accept_group_invitation_with_time_block function missing'
    END as accept_group_invitation_check;

-- Check if get_children_in_care_block function exists
SELECT 
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.routines 
            WHERE routine_name = 'get_children_in_care_block'
        ) THEN '✅ PASS: get_children_in_care_block function exists'
        ELSE '❌ FAIL: get_children_in_care_block function missing'
    END as get_children_in_care_block_check;

-- Check if create_care_exchange function exists
SELECT 
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.routines 
            WHERE routine_name = 'create_care_exchange'
        ) THEN '✅ PASS: create_care_exchange function exists'
        ELSE '❌ FAIL: create_care_exchange function missing'
    END as create_care_exchange_check;

-- Check if select_response_and_reject_others function exists
SELECT 
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.routines 
            WHERE routine_name = 'select_response_and_reject_others'
        ) THEN '✅ PASS: select_response_and_reject_others function exists'
        ELSE '❌ FAIL: select_response_and_reject_others function missing'
    END as select_response_check;

-- ============================================================================
-- STEP 3: Test RLS Policies
-- ============================================================================

-- Check RLS policies for group_invitations
SELECT 
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM pg_policies 
            WHERE tablename = 'group_invitations'
        ) THEN '✅ PASS: RLS policies exist for group_invitations'
        ELSE '❌ FAIL: RLS policies missing for group_invitations'
    END as group_invitations_rls_check;

-- Check RLS policies for invitation_time_blocks
SELECT 
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM pg_policies 
            WHERE tablename = 'invitation_time_blocks'
        ) THEN '✅ PASS: RLS policies exist for invitation_time_blocks'
        ELSE '❌ FAIL: RLS policies missing for invitation_time_blocks'
    END as invitation_time_blocks_rls_check;

-- ============================================================================
-- STEP 4: Test Indexes
-- ============================================================================

-- Check indexes for group_invitations
SELECT 
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM pg_indexes 
            WHERE tablename = 'group_invitations' 
            AND indexname = 'idx_group_invitations_invitee_id'
        ) THEN '✅ PASS: idx_group_invitations_invitee_id index exists'
        ELSE '❌ FAIL: idx_group_invitations_invitee_id index missing'
    END as group_invitations_invitee_index_check;

-- Check indexes for scheduled_blocks
SELECT 
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM pg_indexes 
            WHERE tablename = 'scheduled_blocks' 
            AND indexname = 'idx_scheduled_blocks_care_group_id'
        ) THEN '✅ PASS: idx_scheduled_blocks_care_group_id index exists'
        ELSE '❌ FAIL: idx_scheduled_blocks_care_group_id index missing'
    END as scheduled_blocks_care_group_index_check;

-- ============================================================================
-- STEP 5: Test Data Structure (if data exists)
-- ============================================================================

-- Check if there are any scheduled blocks with care_group_id
SELECT 
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM public.scheduled_blocks 
            WHERE care_group_id IS NOT NULL
        ) THEN '✅ PASS: Found scheduled blocks with care_group_id'
        ELSE 'ℹ️ INFO: No scheduled blocks with care_group_id found (this is normal for new systems)'
    END as care_group_data_check;

-- Check if there are any group invitations
SELECT 
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM public.group_invitations
        ) THEN '✅ PASS: Found group invitations'
        ELSE 'ℹ️ INFO: No group invitations found (this is normal for new systems)'
    END as group_invitations_data_check;

-- ============================================================================
-- STEP 6: Summary Report
-- ============================================================================

SELECT '=== SCHEDULING SYSTEM TEST SUMMARY ===' as summary_header;

SELECT 
    'Database Structure: ' ||
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'scheduled_blocks' AND column_name = 'care_group_id')
        AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'group_invitations')
        AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'invitation_time_blocks')
        THEN '✅ PASS'
        ELSE '❌ FAIL'
    END as structure_status;

SELECT 
    'Required Functions: ' ||
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_name = 'get_available_group_members_for_invitation')
        AND EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_name = 'invite_specific_parents_to_care')
        AND EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_name = 'get_available_time_blocks_for_invitation')
        AND EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_name = 'get_user_children_for_group')
        AND EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_name = 'accept_group_invitation_with_time_block')
        AND EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_name = 'get_children_in_care_block')
        AND EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_name = 'create_care_exchange')
        AND EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_name = 'select_response_and_reject_others')
        THEN '✅ PASS'
        ELSE '❌ FAIL'
    END as functions_status;

SELECT 
    'Security Policies: ' ||
    CASE 
        WHEN EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'group_invitations')
        AND EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'invitation_time_blocks')
        THEN '✅ PASS'
        ELSE '❌ FAIL'
    END as security_status;

SELECT 
    'Performance Indexes: ' ||
    CASE 
        WHEN EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'group_invitations' AND indexname = 'idx_group_invitations_invitee_id')
        AND EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'scheduled_blocks' AND indexname = 'idx_scheduled_blocks_care_group_id')
        THEN '✅ PASS'
        ELSE '❌ FAIL'
    END as indexes_status;

SELECT '=== END OF TEST SUMMARY ===' as summary_footer; 