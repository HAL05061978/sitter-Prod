-- Simple Care Exchange Function
-- Handles both reciprocal and open block requests with clear logic

CREATE OR REPLACE FUNCTION simple_care_exchange(
    p_request_id UUID,
    p_response_id UUID
) RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
    v_request RECORD;
    v_response RECORD;
BEGIN
    -- Get request and response details
    SELECT * INTO v_request FROM care_requests WHERE id = p_request_id;
    SELECT * INTO v_response FROM care_responses WHERE id = p_response_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Request not found';
    END IF;
    
    IF v_response IS NULL THEN
        RAISE EXCEPTION 'Response not found';
    END IF;
    
    -- Check if response is already accepted
    IF v_response.status = 'accepted' THEN
        RAISE EXCEPTION 'Response has already been accepted';
    END IF;
    
    -- Handle Reciprocal Requests
    IF v_request.request_type = 'reciprocal' THEN
        -- Create 2 blocks for reciprocal exchange:
        -- 1. Parent A provides care for Parent B's child (reciprocal time)
        -- 2. Parent B provides care for Parent A's child (original time)
        
        INSERT INTO scheduled_care (
            group_id, parent_id, child_id, care_date, start_time, end_time,
            care_type, status, related_request_id, notes
        ) VALUES (
            v_request.group_id, v_request.requester_id, v_response.reciprocal_child_id,
            v_response.reciprocal_date, v_response.reciprocal_start_time, v_response.reciprocal_end_time,
            'provided', 'confirmed', v_request.id, 'Reciprocal care provided'
        );
        
        INSERT INTO scheduled_care (
            group_id, parent_id, child_id, care_date, start_time, end_time,
            care_type, status, related_request_id, notes
        ) VALUES (
            v_request.group_id, v_response.responder_id, v_request.child_id,
            v_request.requested_date, v_request.start_time, v_request.end_time,
            'provided', 'confirmed', v_request.id, 'Reciprocal care provided'
        );
        
        RAISE NOTICE 'Created 2 blocks for reciprocal exchange';
        
    -- Handle Open Block Requests
    ELSIF v_request.request_type = 'open_block' THEN
        -- Create 2 blocks for open block exchange:
        -- 1. Parent B provides care for Parent C's child (original time)
        -- 2. Parent C provides care for Parent B's child (new time)
        
        INSERT INTO scheduled_care (
            group_id, parent_id, child_id, care_date, start_time, end_time,
            care_type, status, related_request_id, notes
        ) VALUES (
            v_request.group_id, v_request.requester_id, v_response.reciprocal_child_id,
            v_request.reciprocal_date, v_request.reciprocal_start_time, v_request.reciprocal_end_time,
            'provided', 'confirmed', v_request.id, 'Open block care provided'
        );
        
        INSERT INTO scheduled_care (
            group_id, parent_id, child_id, care_date, start_time, end_time,
            care_type, status, related_request_id, notes
        ) VALUES (
            v_request.group_id, v_response.responder_id, v_request.child_id,
            v_request.requested_date, v_request.start_time, v_request.end_time,
            'provided', 'confirmed', v_request.id, 'Open block care provided'
        );
        
        RAISE NOTICE 'Created 2 blocks for open block exchange';
        
    -- Handle Regular Requests
    ELSE
        -- Create 2 blocks for regular exchange:
        -- 1. Parent A needs care (original request)
        -- 2. Parent B provides care (original request)
        
        INSERT INTO scheduled_care (
            group_id, parent_id, child_id, care_date, start_time, end_time,
            care_type, status, related_request_id, notes
        ) VALUES (
            v_request.group_id, v_request.requester_id, v_request.child_id,
            v_request.requested_date, v_request.start_time, v_request.end_time,
            'needed', 'confirmed', v_request.id, 'Care needed'
        );
        
        INSERT INTO scheduled_care (
            group_id, parent_id, child_id, care_date, start_time, end_time,
            care_type, status, related_request_id, notes
        ) VALUES (
            v_request.group_id, v_response.responder_id, v_request.child_id,
            v_request.requested_date, v_request.start_time, v_request.end_time,
            'provided', 'confirmed', v_request.id, 'Care provided'
        );
        
        RAISE NOTICE 'Created 2 blocks for regular exchange';
    END IF;
    
    -- Mark response as accepted
    UPDATE care_responses 
    SET status = 'accepted'
    WHERE id = p_response_id;
    
    RAISE NOTICE 'Successfully created care exchange for request % and response %', p_request_id, p_response_id;
END;
$$;

GRANT EXECUTE ON FUNCTION simple_care_exchange(UUID, UUID) TO authenticated; 