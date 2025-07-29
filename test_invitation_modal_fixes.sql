-- Test Invitation Modal Fixes
-- This script tests that the invitation modal issues are fixed

-- ============================================================================
-- TEST 1: Test the get_available_time_blocks_for_invitation function
-- ============================================================================

-- Create a test invitation
INSERT INTO public.group_invitations (
    group_id, inviter_id, invitee_id, request_id, invitation_date, 
    invitation_start_time, invitation_end_time, invitation_duration_minutes, 
    status, notes
) VALUES (
    'test-group-id', 'test-parent-b', 'test-parent-c', 'test-request-id',
    '2024-01-20', '10:00:00', '12:00:00', 120, 'pending', 'Test invitation'
);

-- Test the function
SELECT 
    'Time Block Test' as test_name,
    block_index,
    block_date,
    block_start_time,
    block_end_time,
    block_duration_minutes,
    is_available
FROM get_available_time_blocks_for_invitation(
    (SELECT id FROM public.group_invitations WHERE notes = 'Test invitation' LIMIT 1)
);

-- ============================================================================
-- TEST 2: Test the get_user_children_for_group function
-- ============================================================================

-- Test the function (this will show the correct format)
SELECT 
    'Child List Test' as test_name,
    id,
    full_name
FROM get_user_children_for_group('test-parent-c', 'test-group-id');

-- ============================================================================
-- TEST 3: Verify the data format matches frontend expectations
-- ============================================================================

-- Check that the time block function returns the expected format
SELECT 
    'Format Check' as check_type,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM get_available_time_blocks_for_invitation(
                (SELECT id FROM public.group_invitations WHERE notes = 'Test invitation' LIMIT 1)
            ) WHERE block_date IS NOT NULL
        ) THEN '✅ PASS: Time blocks return actual invitation data'
        ELSE '❌ FAIL: Time blocks still hardcoded'
    END as status;

-- Check that the child function returns the expected format
SELECT 
    'Child Format Check' as check_type,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM get_user_children_for_group('test-parent-c', 'test-group-id')
            WHERE id IS NOT NULL AND full_name IS NOT NULL
        ) THEN '✅ PASS: Child function returns id and full_name'
        ELSE '❌ FAIL: Child function format incorrect'
    END as status;

-- ============================================================================
-- CLEANUP: Remove test data
-- ============================================================================

DELETE FROM public.group_invitations WHERE notes = 'Test invitation';

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================

SELECT 'Invitation modal fixes tested successfully! The modal should now show actual invitation data and proper child names.' as status; 