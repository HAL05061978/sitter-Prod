-- Debug script to test create_care_exchange function
-- This will help us understand why only reciprocal time blocks are showing

-- First, let's see what's in our tables
SELECT '=== CURRENT CARE REQUESTS ===' as info;
SELECT 
    id,
    requester_id,
    request_type,
    status,
    requested_date,
    start_time,
    end_time,
    child_id
FROM care_requests 
ORDER BY created_at DESC;

SELECT '=== CURRENT CARE RESPONSES ===' as info;
SELECT 
    id,
    request_id,
    responder_id,
    response_type,
    status,
    reciprocal_date,
    reciprocal_start_time,
    reciprocal_end_time,
    reciprocal_child_id
FROM care_responses 
ORDER BY created_at DESC;

SELECT '=== CURRENT SCHEDULED CARE ===' as info;
SELECT 
    id,
    group_id,
    parent_id,
    child_id,
    care_date,
    start_time,
    end_time,
    care_type,
    status,
    related_request_id,
    notes
FROM scheduled_care 
ORDER BY created_at DESC;

-- Let's test the create_care_exchange function with a specific request/response
-- First, find a reciprocal request and response to test with
DO $$
DECLARE
    v_request_id UUID;
    v_response_id UUID;
    v_request RECORD;
    v_response RECORD;
BEGIN
    -- Find a reciprocal request with a pending response
    SELECT r.id, resp.id 
    INTO v_request_id, v_response_id
    FROM care_requests r
    JOIN care_responses resp ON r.id = resp.request_id
    WHERE r.request_type = 'reciprocal' 
    AND resp.status = 'pending'
    AND resp.reciprocal_date IS NOT NULL
    LIMIT 1;
    
    IF v_request_id IS NULL THEN
        RAISE NOTICE 'No reciprocal request with pending response found for testing';
        RETURN;
    END IF;
    
    -- Get the details
    SELECT * INTO v_request FROM care_requests WHERE id = v_request_id;
    SELECT * INTO v_response FROM care_responses WHERE id = v_response_id;
    
    RAISE NOTICE 'Testing with request % and response %', v_request_id, v_response_id;
    RAISE NOTICE 'Request: type=%, date=%, time=% to %', v_request.request_type, v_request.requested_date, v_request.start_time, v_request.end_time;
    RAISE NOTICE 'Response: type=%, status=%, reciprocal_date=%, reciprocal_time=% to %', 
        v_response.response_type, v_response.status, v_response.reciprocal_date, 
        v_response.reciprocal_start_time, v_response.reciprocal_end_time;
    
    -- Test the function
    PERFORM create_care_exchange(v_request_id, v_response_id);
    
    RAISE NOTICE 'create_care_exchange completed successfully';
    
    -- Show what was created
    RAISE NOTICE '=== SCHEDULED CARE AFTER FUNCTION ===';
    FOR v_record IN 
        SELECT 
            parent_id,
            child_id,
            care_date,
            start_time,
            end_time,
            care_type,
            status,
            notes
        FROM scheduled_care 
        WHERE related_request_id = v_request_id
        ORDER BY care_date, start_time
    LOOP
        RAISE NOTICE 'Block: parent=%, child=%, date=%, time=% to %, type=%, status=%, notes=%', 
            v_record.parent_id, v_record.child_id, v_record.care_date, 
            v_record.start_time, v_record.end_time, v_record.care_type, 
            v_record.status, v_record.notes;
    END LOOP;
    
END $$;

-- Show final state
SELECT '=== FINAL SCHEDULED CARE ===' as info;
SELECT 
    id,
    group_id,
    parent_id,
    child_id,
    care_date,
    start_time,
    end_time,
    care_type,
    status,
    related_request_id,
    notes
FROM scheduled_care 
ORDER BY created_at DESC; 