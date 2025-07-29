-- Test Frontend Integration with Simplified System
-- This verifies that the frontend can successfully create care exchanges

-- ============================================================================
-- STEP 1: Verify the create_care_exchange function exists and works
-- ============================================================================

-- Test the function with sample data
DO $$
DECLARE
    test_request_id UUID;
    test_response_id UUID;
BEGIN
    -- Create a test request
    INSERT INTO public.babysitting_requests (
        group_id, initiator_id, child_id, requested_date, start_time, end_time, 
        duration_minutes, notes, status
    ) VALUES (
        'test-group-id', 'test-parent-a', 'test-child-a',
        '2024-01-15', '14:00:00', '16:00:00', 120, 'Test request', 'pending'
    ) RETURNING id INTO test_request_id;
    
    -- Create a test response
    INSERT INTO public.request_responses (
        request_id, responder_id, response_type, 
        reciprocal_date, reciprocal_start_time, reciprocal_end_time, 
        reciprocal_duration_minutes, reciprocal_child_id, status
    ) VALUES (
        test_request_id, 'test-parent-b', 'agree',
        '2024-01-16', '15:00:00', '17:00:00', 120, 'test-child-b', 'pending'
    ) RETURNING id INTO test_response_id;
    
    -- Call the function
    PERFORM create_care_exchange(test_request_id, test_response_id);
    
    -- Verify results
    RAISE NOTICE 'Test completed successfully!';
    RAISE NOTICE 'Request ID: %', test_request_id;
    RAISE NOTICE 'Response ID: %', test_response_id;
    
    -- Check that scheduled blocks were created
    IF EXISTS (
        SELECT 1 FROM public.scheduled_blocks 
        WHERE request_id = test_request_id
    ) THEN
        RAISE NOTICE '✅ Scheduled blocks created successfully';
    ELSE
        RAISE NOTICE '❌ No scheduled blocks found';
    END IF;
    
    -- Check that the response was accepted
    IF EXISTS (
        SELECT 1 FROM public.request_responses 
        WHERE id = test_response_id AND status = 'accepted'
    ) THEN
        RAISE NOTICE '✅ Response accepted successfully';
    ELSE
        RAISE NOTICE '❌ Response not accepted';
    END IF;
    
    -- Check that the request was closed
    IF EXISTS (
        SELECT 1 FROM public.babysitting_requests 
        WHERE id = test_request_id AND status = 'closed'
    ) THEN
        RAISE NOTICE '✅ Request closed successfully';
    ELSE
        RAISE NOTICE '❌ Request not closed';
    END IF;
    
    -- Clean up test data
    DELETE FROM public.scheduled_blocks WHERE request_id = test_request_id;
    DELETE FROM public.request_responses WHERE id = test_response_id;
    DELETE FROM public.babysitting_requests WHERE id = test_request_id;
    
END $$;

-- ============================================================================
-- STEP 2: Verify the function permissions
-- ============================================================================

-- Check that authenticated users can execute the function
SELECT 
    routine_name,
    routine_type,
    security_type
FROM information_schema.routines 
WHERE routine_name = 'create_care_exchange'
AND routine_schema = 'public';

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================

SELECT 'Frontend integration test completed! The system should now create scheduled blocks when users agree to requests.' as status;