-- Fix for Reciprocal Request Flow
-- This function handles reciprocal request acceptance with automatic scheduled block creation

-- ============================================================================
-- STEP 1: Create function to accept reciprocal request
-- ============================================================================

CREATE OR REPLACE FUNCTION accept_reciprocal_request(
    p_response_id UUID,
    p_acceptor_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_response care_responses%ROWTYPE;
    v_request care_requests%ROWTYPE;
    v_duration_minutes INTEGER;
    v_reciprocal_duration_minutes INTEGER;
    v_care_group_id UUID;
BEGIN
    -- Get the response details
    SELECT * INTO v_response FROM care_responses WHERE id = p_response_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Response not found';
    END IF;
    
    -- Get the original request details
    SELECT * INTO v_request FROM care_requests WHERE id = v_response.request_id;
    
    -- Validate that the acceptor is the responder
    IF v_response.responder_id != p_acceptor_id THEN
        RAISE EXCEPTION 'Only the responder can accept their own response';
    END IF;
    
    -- Validate that the response is pending
    IF v_response.status != 'pending' THEN
        RAISE EXCEPTION 'Response is not pending';
    END IF;
    
    -- Calculate durations
    v_duration_minutes := EXTRACT(EPOCH FROM (v_request.end_time::time - v_request.start_time::time)) / 60;
    v_reciprocal_duration_minutes := EXTRACT(EPOCH FROM (v_response.reciprocal_end_time::time - v_response.reciprocal_start_time::time)) / 60;
    
    -- Create a care group ID for this reciprocal arrangement
    v_care_group_id := gen_random_uuid();
    
    -- Create 4 scheduled blocks for the reciprocal arrangement:
    
    -- 1. Parent A needs care for their child on the ORIGINAL time slot
    INSERT INTO scheduled_blocks (
        group_id, parent_id, child_id, scheduled_date, start_time, end_time, 
        duration_minutes, block_type, status, request_id, notes, care_group_id
    ) VALUES (
        v_request.group_id, v_request.requester_id, v_request.child_id,
        v_request.requested_date, v_request.start_time, v_request.end_time,
        v_duration_minutes, 'care_needed', 'confirmed', v_request.id, 
        'Original care request', v_care_group_id
    );
    
    -- 2. Parent B provides care for Parent A's child on the ORIGINAL time slot
    INSERT INTO scheduled_blocks (
        group_id, parent_id, child_id, scheduled_date, start_time, end_time, 
        duration_minutes, block_type, status, request_id, notes, care_group_id
    ) VALUES (
        v_request.group_id, v_response.responder_id, v_request.child_id,
        v_request.requested_date, v_request.start_time, v_request.end_time,
        v_duration_minutes, 'care_provided', 'confirmed', v_request.id, 
        'Reciprocal care provision', v_care_group_id
    );
    
    -- 3. Parent B needs care for their child on the RECIPROCAL time slot
    INSERT INTO scheduled_blocks (
        group_id, parent_id, child_id, scheduled_date, start_time, end_time, 
        duration_minutes, block_type, status, request_id, notes, care_group_id
    ) VALUES (
        v_request.group_id, v_response.responder_id, v_response.reciprocal_child_id,
        v_response.reciprocal_date, v_response.reciprocal_start_time, v_response.reciprocal_end_time,
        v_reciprocal_duration_minutes, 'care_needed', 'confirmed', v_request.id, 
        'Reciprocal care request', v_care_group_id
    );
    
    -- 4. Parent A provides care for Parent B's child on the RECIPROCAL time slot
    INSERT INTO scheduled_blocks (
        group_id, parent_id, child_id, scheduled_date, start_time, end_time, 
        duration_minutes, block_type, status, request_id, notes, care_group_id
    ) VALUES (
        v_request.group_id, v_request.requester_id, v_response.reciprocal_child_id,
        v_response.reciprocal_date, v_response.reciprocal_start_time, v_response.reciprocal_end_time,
        v_reciprocal_duration_minutes, 'care_provided', 'confirmed', v_request.id, 
        'Reciprocal care provision', v_care_group_id
    );
    
    -- Mark response as accepted
    UPDATE care_responses 
    SET status = 'accepted'
    WHERE id = p_response_id;
    
    -- Update the original request status
    UPDATE care_requests 
    SET status = 'accepted',
        responder_id = v_response.responder_id,
        response_notes = v_response.response_notes
    WHERE id = v_request.id;
    
    RAISE NOTICE 'Successfully accepted reciprocal request %. Created care blocks for both parents.', p_response_id;
END;
$$;

GRANT EXECUTE ON FUNCTION accept_reciprocal_request(UUID, UUID) TO authenticated;

-- ============================================================================
-- STEP 2: Create function to handle reciprocal request response
-- ============================================================================

CREATE OR REPLACE FUNCTION submit_reciprocal_response(
    p_request_id UUID,
    p_responder_id UUID,
    p_response_type VARCHAR(10),
    p_reciprocal_date DATE,
    p_reciprocal_start_time TIME,
    p_reciprocal_end_time TIME,
    p_reciprocal_child_id UUID,
    p_notes TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_request care_requests%ROWTYPE;
    v_response_id UUID;
BEGIN
    -- Get the original request details
    SELECT * INTO v_request FROM care_requests WHERE id = p_request_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Original request not found';
    END IF;
    
    -- Validate that the selected child belongs to the responder
    IF NOT EXISTS (
        SELECT 1 FROM children 
        WHERE id = p_reciprocal_child_id 
        AND parent_id = p_responder_id
    ) THEN
        RAISE EXCEPTION 'Selected child does not belong to the responder';
    END IF;
    
    -- Check if a response already exists for this request and responder
    IF EXISTS (
        SELECT 1 FROM care_responses 
        WHERE request_id = p_request_id 
        AND responder_id = p_responder_id
    ) THEN
        RAISE EXCEPTION 'You have already submitted a response for this request';
    END IF;
    
    -- Create the response
    INSERT INTO care_responses (
        request_id,
        responder_id,
        response_type,
        response_notes,
        status,
        reciprocal_date,
        reciprocal_start_time,
        reciprocal_end_time,
        reciprocal_child_id
    ) VALUES (
        p_request_id,
        p_responder_id,
        p_response_type,
        COALESCE(p_notes, ''),
        'pending',
        p_reciprocal_date,
        p_reciprocal_start_time,
        p_reciprocal_end_time,
        p_reciprocal_child_id
    );
    
    -- Get the ID of the newly created response
    SELECT id INTO v_response_id 
    FROM care_responses 
    WHERE request_id = p_request_id 
    AND responder_id = p_responder_id 
    ORDER BY created_at DESC 
    LIMIT 1;
    
    -- If this is an accept response, automatically create the scheduled blocks
    IF p_response_type = 'accept' THEN
        PERFORM accept_reciprocal_request(v_response_id, p_responder_id);
    END IF;
    
    RAISE NOTICE 'Successfully created reciprocal response %', v_response_id;
    
    RETURN v_response_id;
END;
$$;

GRANT EXECUTE ON FUNCTION submit_reciprocal_response(UUID, UUID, VARCHAR, DATE, TIME, TIME, UUID, TEXT) TO authenticated;

-- ============================================================================
-- STEP 3: Verification queries
-- ============================================================================

SELECT 
    'Function Check' as test_name,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.routines 
            WHERE routine_name = 'accept_reciprocal_request'
            AND routine_type = 'FUNCTION'
        ) THEN '✅ PASS: accept_reciprocal_request exists'
        ELSE '❌ FAIL: accept_reciprocal_request missing'
    END as status;

SELECT 
    'Function Check' as test_name,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.routines 
            WHERE routine_name = 'submit_reciprocal_response'
            AND routine_type = 'FUNCTION'
        ) THEN '✅ PASS: submit_reciprocal_response exists'
        ELSE '❌ FAIL: submit_reciprocal_response missing'
    END as status;

SELECT 'Reciprocal request flow has been fixed to automatically create scheduled blocks.' as note; 