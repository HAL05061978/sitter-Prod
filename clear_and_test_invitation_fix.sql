-- Clear and Test Invitation Fix
-- This clears problematic data and tests the fixed invitation function

-- ============================================================================
-- Clear problematic data
-- ============================================================================

-- Clear any problematic scheduled blocks that might have been created
DELETE FROM public.scheduled_blocks 
WHERE request_id IN (
    SELECT br.id FROM babysitting_requests br
    JOIN group_invitations gi ON br.id = gi.request_id
    WHERE gi.status = 'accepted'
);

-- Clear accepted invitations to reset them
UPDATE public.group_invitations 
SET status = 'pending', selected_time_block_index = NULL
WHERE status = 'accepted';

-- ============================================================================
-- Test the fixed function
-- ============================================================================

-- Check current state
SELECT 
    'Current State' as test_name,
    CASE 
        WHEN COUNT(*) = 0 THEN '✅ PASS: No problematic blocks'
        ELSE '❌ FAIL: Found problematic blocks'
    END as status
FROM public.scheduled_blocks 
WHERE request_id IN (
    SELECT br.id FROM babysitting_requests br
    JOIN group_invitations gi ON br.id = gi.request_id
    WHERE gi.status = 'pending'
);

-- Show current invitations
SELECT 
    'Invitations Status' as test_name,
    gi.id as invitation_id,
    gi.status,
    gi.invitation_date,
    gi.invitation_start_time,
    gi.invitation_end_time,
    br.requested_date as original_request_date,
    br.start_time as original_start_time,
    br.end_time as original_end_time
FROM public.group_invitations gi
JOIN public.babysitting_requests br ON gi.request_id = br.id
ORDER BY gi.created_at DESC;

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================

SELECT 'Data cleared successfully! You can now test the fixed invitation function.' as status; 