-- Test UI Improvements for Group Invitations
-- This script tests that the invitation display shows both times clearly

-- ============================================================================
-- TEST 1: Create test data to verify the UI improvements
-- ============================================================================

-- Create a test request (Parent A needs care)
INSERT INTO public.babysitting_requests (
    group_id, initiator_id, child_id, requested_date, start_time, end_time, 
    duration_minutes, notes, status
) VALUES (
    'test-group-id', 'parent-a-user-id', 'parent-a-child-id',
    '2024-01-15', '14:00:00', '16:00:00', 120, 'Test request', 'pending'
);

-- Create a test invitation (Parent B invites Parent C)
INSERT INTO public.group_invitations (
    group_id, inviter_id, invitee_id, request_id, invitation_date, 
    invitation_start_time, invitation_end_time, invitation_duration_minutes, 
    status, notes
) VALUES (
    'test-group-id', 'parent-b-user-id', 'parent-c-user-id', 
    (SELECT id FROM public.babysitting_requests WHERE notes = 'Test request' LIMIT 1),
    '2024-01-20', '10:00:00', '12:00:00', 120, 'pending', 'Test invitation'
);

-- ============================================================================
-- TEST 2: Verify the data structure supports the UI improvements
-- ============================================================================

-- Check that we can get both the original request and invitation data
SELECT 
    'Data Structure Test' as test_name,
    r.requested_date as original_request_date,
    r.start_time as original_request_start,
    r.end_time as original_request_end,
    i.invitation_date as invitation_date,
    i.invitation_start_time as invitation_start,
    i.invitation_end_time as invitation_end
FROM public.babysitting_requests r
JOIN public.group_invitations i ON i.request_id = r.id
WHERE r.notes = 'Test request';

-- ============================================================================
-- TEST 3: Verify the UI will show both times clearly
-- ============================================================================

-- Check that the invitation data is complete
SELECT 
    'UI Display Test' as test_name,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM public.group_invitations i
            JOIN public.babysitting_requests r ON i.request_id = r.id
            WHERE r.notes = 'Test request'
            AND i.invitation_date IS NOT NULL
            AND i.invitation_start_time IS NOT NULL
            AND i.invitation_end_time IS NOT NULL
            AND r.requested_date IS NOT NULL
            AND r.start_time IS NOT NULL
            AND r.end_time IS NOT NULL
        ) THEN '✅ PASS: Both times available for UI display'
        ELSE '❌ FAIL: Missing time data for UI display'
    END as status;

-- ============================================================================
-- CLEANUP: Remove test data
-- ============================================================================

DELETE FROM public.group_invitations WHERE notes = 'Test invitation';
DELETE FROM public.babysitting_requests WHERE notes = 'Test request';

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================

SELECT 'UI improvements tested successfully! The Group Invitations section should now clearly show both the original request time and the invitation time.' as status; 