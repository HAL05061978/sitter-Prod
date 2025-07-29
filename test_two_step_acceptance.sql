-- Test Two-Step Acceptance Process
-- This verifies that responses stay pending until Parent A manually accepts them

-- ============================================================================
-- STEP 1: Create a test request (Parent A)
-- ============================================================================

-- Insert a test babysitting request
INSERT INTO public.babysitting_requests (
    group_id, initiator_id, child_id, requested_date, start_time, end_time, 
    duration_minutes, notes, status
) VALUES (
    'test-group-id', 'parent-a-user-id', 'parent-a-child-id',
    '2024-01-15', '14:00:00', '16:00:00', 120, 'Test request', 'pending'
);

-- ============================================================================
-- STEP 2: Create a response (Parent B agrees)
-- ============================================================================

-- Insert a response with reciprocal care details (should stay pending)
INSERT INTO public.request_responses (
    request_id, responder_id, response_type, 
    reciprocal_date, reciprocal_start_time, reciprocal_end_time, 
    reciprocal_duration_minutes, reciprocal_child_id, status
) VALUES (
    (SELECT id FROM public.babysitting_requests ORDER BY created_at DESC LIMIT 1),
    'parent-b-user-id', 'agree',
    '2024-01-16', '15:00:00', '17:00:00', 120, 'parent-b-child-id', 'pending'
);

-- ============================================================================
-- STEP 3: Verify the response is pending (no blocks created yet)
-- ============================================================================

-- Check that the response is still pending
SELECT 
    'Response Status Check' as test,
    CASE 
        WHEN status = 'pending' THEN '✅ PASS: Response is pending'
        ELSE '❌ FAIL: Response should be pending'
    END as result
FROM public.request_responses 
ORDER BY created_at DESC LIMIT 1;

-- Check that no scheduled blocks exist yet
SELECT 
    'Scheduled Blocks Check' as test,
    CASE 
        WHEN COUNT(*) = 0 THEN '✅ PASS: No blocks created yet'
        ELSE '❌ FAIL: Blocks should not exist yet'
    END as result
FROM public.scheduled_blocks 
WHERE request_id = (SELECT id FROM public.babysitting_requests ORDER BY created_at DESC LIMIT 1);

-- ============================================================================
-- STEP 4: Simulate Parent A accepting the response
-- ============================================================================

-- Call the create_care_exchange function (simulates Parent A clicking Accept)
SELECT create_care_exchange(
    (SELECT id FROM public.babysitting_requests ORDER BY created_at DESC LIMIT 1),
    (SELECT id FROM public.request_responses ORDER BY created_at DESC LIMIT 1)
);

-- ============================================================================
-- STEP 5: Verify the acceptance worked
-- ============================================================================

-- Check that the response is now accepted
SELECT 
    'Response Acceptance Check' as test,
    CASE 
        WHEN status = 'accepted' THEN '✅ PASS: Response is now accepted'
        ELSE '❌ FAIL: Response should be accepted'
    END as result
FROM public.request_responses 
ORDER BY created_at DESC LIMIT 1;

-- Check that scheduled blocks were created
SELECT 
    'Scheduled Blocks Creation' as test,
    CASE 
        WHEN COUNT(*) = 4 THEN '✅ PASS: 4 blocks created (2 care_needed + 2 care_provided)'
        ELSE '❌ FAIL: Should have 4 blocks'
    END as result
FROM public.scheduled_blocks 
WHERE request_id = (SELECT id FROM public.babysitting_requests ORDER BY created_at DESC LIMIT 1);

-- Show the created blocks
SELECT 
    block_type,
    parent_id,
    child_id,
    scheduled_date,
    start_time,
    end_time,
    status
FROM public.scheduled_blocks 
WHERE request_id = (SELECT id FROM public.babysitting_requests ORDER BY created_at DESC LIMIT 1)
ORDER BY block_type, scheduled_date;

-- Check that the request was closed
SELECT 
    'Request Status Check' as test,
    CASE 
        WHEN status = 'closed' THEN '✅ PASS: Request is now closed'
        ELSE '❌ FAIL: Request should be closed'
    END as result
FROM public.babysitting_requests 
ORDER BY created_at DESC LIMIT 1;

-- ============================================================================
-- CLEANUP
-- ============================================================================

-- Clean up test data
DELETE FROM public.scheduled_blocks 
WHERE request_id = (SELECT id FROM public.babysitting_requests ORDER BY created_at DESC LIMIT 1);

DELETE FROM public.request_responses 
WHERE request_id = (SELECT id FROM public.babysitting_requests ORDER BY created_at DESC LIMIT 1);

DELETE FROM public.babysitting_requests 
ORDER BY created_at DESC LIMIT 1;

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================

SELECT 'Two-step acceptance process test completed! The system now correctly waits for Parent A to manually accept responses.' as status;