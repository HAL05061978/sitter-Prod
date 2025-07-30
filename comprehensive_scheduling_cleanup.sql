-- Comprehensive Scheduling Cleanup Script
-- This script clears ALL scheduling-related data and backup tables
-- while preserving core app functionality (profiles, children, groups, etc.)

-- ============================================================================
-- STEP 1: CLEAR ALL SCHEDULING DATA IN CORRECT ORDER
-- ============================================================================

-- Clear block_connections first (depends on scheduled_blocks)
DELETE FROM public.block_connections;

-- Clear scheduled_blocks (they reference requests)
DELETE FROM public.scheduled_blocks;

-- Clear request_responses (they reference requests)
DELETE FROM public.request_responses;

-- Clear babysitting_requests
DELETE FROM public.babysitting_requests;

-- Clear group_invitations
DELETE FROM public.group_invitations;

-- Clear invitation_time_blocks (if table exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'invitation_time_blocks') THEN
        DELETE FROM public.invitation_time_blocks;
        RAISE NOTICE 'Cleared invitation_time_blocks table';
    ELSE
        RAISE NOTICE 'invitation_time_blocks table does not exist, skipping';
    END IF;
END $$;

-- ============================================================================
-- STEP 2: CLEAR ALL BACKUP TABLES
-- ============================================================================

-- Clear backup tables that were created during previous cleanup operations
DROP TABLE IF EXISTS backup_scheduled_blocks;
DROP TABLE IF EXISTS backup_babysitting_requests;
DROP TABLE IF EXISTS backup_request_responses;
DROP TABLE IF EXISTS backup_group_invitations;
DROP TABLE IF EXISTS invitation_time_blocks_backup;

-- ============================================================================
-- STEP 3: VERIFY CORE APP DATA IS PRESERVED
-- ============================================================================

-- Check that fundamental data is still intact
SELECT 
    'Core App Data Verification' as verification_type,
    (SELECT COUNT(*) FROM public.profiles) as profiles_count,
    (SELECT COUNT(*) FROM public.children) as children_count,
    (SELECT COUNT(*) FROM public.groups) as groups_count,
    (SELECT COUNT(*) FROM public.group_members) as group_members_count,
    (SELECT COUNT(*) FROM public.child_group_members) as child_group_members_count,
    (SELECT COUNT(*) FROM public.messages) as messages_count;

-- ============================================================================
-- STEP 4: VERIFY ALL SCHEDULING DATA IS CLEARED
-- ============================================================================

-- Verify that all scheduling data is cleared
SELECT 
    'Scheduling Data Verification' as verification_type,
    (SELECT COUNT(*) FROM public.scheduled_blocks) as scheduled_blocks_count,
    (SELECT COUNT(*) FROM public.babysitting_requests) as requests_count,
    (SELECT COUNT(*) FROM public.request_responses) as responses_count,
    (SELECT COUNT(*) FROM public.group_invitations) as invitations_count,
    (SELECT COUNT(*) FROM public.block_connections) as connections_count,
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'invitation_time_blocks')
        THEN (SELECT COUNT(*) FROM public.invitation_time_blocks)
        ELSE 0
    END as invitation_time_blocks_count;

-- ============================================================================
-- STEP 5: SUCCESS MESSAGE
-- ============================================================================

SELECT '✅ COMPREHENSIVE SCHEDULING CLEANUP COMPLETED' as status;
SELECT 'All scheduling data and backup tables have been cleared.' as message;
SELECT 'Core app functionality (profiles, children, groups) has been preserved.' as note; 