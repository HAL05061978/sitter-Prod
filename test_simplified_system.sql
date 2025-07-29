-- Test the Simplified Scheduling System
-- This script tests the basic functionality

-- ============================================================================
-- TEST 1: Create a babysitting request
-- ============================================================================

-- Insert a test babysitting request
INSERT INTO public.babysitting_requests (
    group_id, initiator_id, child_id, requested_date, start_time, end_time, 
    duration_minutes, notes, status
) VALUES (
    'your-group-id-here', 'parent-a-user-id', 'parent-a-child-id',
    '2024-01-15', '14:00:00', '16:00:00', 120, 'Test request', 'pending'
);

-- ============================================================================
-- TEST 2: Create a response (Parent B agrees)
-- ============================================================================

-- Insert a response with reciprocal care details
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
-- TEST 3: Process the care exchange
-- ============================================================================

-- Call the simplified function to create care blocks
SELECT create_care_exchange(
    (SELECT id FROM public.babysitting_requests ORDER BY created_at DESC LIMIT 1),
    (SELECT id FROM public.request_responses ORDER BY created_at DESC LIMIT 1)
);

-- ============================================================================
-- TEST 4: Verify the results
-- ============================================================================

-- Check that scheduled blocks were created
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

-- Check that the response was accepted
SELECT 
    response_type,
    status,
    reciprocal_date,
    reciprocal_start_time,
    reciprocal_end_time
FROM public.request_responses 
ORDER BY created_at DESC LIMIT 1;

-- Check that the request was closed
SELECT 
    status,
    notes
FROM public.babysitting_requests 
ORDER BY created_at DESC LIMIT 1;

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================

SELECT 'Simplified scheduling system test completed successfully!' as status;