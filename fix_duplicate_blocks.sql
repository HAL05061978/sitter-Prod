-- Fix for duplicate blocks in reciprocal requests
-- This function creates the correct number of blocks for reciprocal exchanges

CREATE OR REPLACE FUNCTION create_care_exchange(
    p_request_id UUID,
    p_response_id UUID
) RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
    v_request RECORD;
    v_response RECORD;
    v_care_group_id UUID;
    v_reciprocal_duration_minutes INTEGER;
BEGIN
    -- Get request and response details from the new tables
    SELECT * INTO v_request FROM public.care_requests WHERE id = p_request_id;
    SELECT * INTO v_response FROM public.care_responses WHERE id = p_response_id;
    
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
    
    -- Generate care group ID to link related blocks
    v_care_group_id := gen_random_uuid();
    
    -- Debug logging
    RAISE NOTICE 'Creating care exchange for request % (type: %) and response % (type: %)', 
        p_request_id, v_request.request_type, p_response_id, v_response.response_type;
    RAISE NOTICE 'Request details: date=%, time=% to %, child=%', 
        v_request.requested_date, v_request.start_time, v_request.end_time, v_request.child_id;
    RAISE NOTICE 'Response details: reciprocal_date=%, reciprocal_time=% to %, reciprocal_child=%', 
        v_response.reciprocal_date, v_response.reciprocal_start_time, v_response.reciprocal_end_time, v_response.reciprocal_child_id;
    
    -- Calculate reciprocal duration if provided
    IF v_response.reciprocal_start_time IS NOT NULL AND v_response.reciprocal_end_time IS NOT NULL THEN
        v_reciprocal_duration_minutes := EXTRACT(EPOCH FROM (v_response.reciprocal_end_time::time - v_response.reciprocal_start_time::time)) / 60;
    ELSE
        v_reciprocal_duration_minutes := v_request.duration_minutes;
    END IF;
    
    -- For reciprocal requests, only create the reciprocal blocks (initial blocks already exist)
    -- For regular requests, create both initial and reciprocal blocks
    IF v_request.request_type = 'reciprocal' THEN
        RAISE NOTICE 'Reciprocal request: Only creating reciprocal blocks (initial blocks already exist)';
    ELSE
        -- Create scheduled care blocks for the original request (only for non-reciprocal requests)
        INSERT INTO public.scheduled_care (
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
        ) VALUES (
            v_request.group_id,
            v_request.requester_id, -- Parent A needs care
            v_request.child_id,
            v_request.requested_date,
            v_request.start_time,
            v_request.end_time,
            'needed',
            'confirmed',
            v_request.id,
            COALESCE(v_request.notes, 'Initial care needed')
        );
        
        -- Create scheduled care block for Parent B providing care (original request)
        INSERT INTO public.scheduled_care (
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
        ) VALUES (
            v_request.group_id,
            v_response.responder_id, -- Parent B provides care
            v_request.child_id,
            v_request.requested_date,
            v_request.start_time,
            v_request.end_time,
            'provided',
            'confirmed',
            v_request.id,
            COALESCE(v_response.response_notes, 'Initial care provided')
        );
        
        RAISE NOTICE 'Created initial care blocks: Parent A needs care, Parent B provides care';
    END IF;
    
    -- If this is a reciprocal response, create the reciprocal care blocks
    -- FIXED: Check for pending reciprocal responses (not just accept)
    IF (v_response.response_type = 'accept' OR (v_response.response_type = 'pending' AND v_request.request_type = 'reciprocal')) 
       AND v_response.reciprocal_date IS NOT NULL THEN
        -- Create scheduled care block for Parent B needing reciprocal care
        INSERT INTO public.scheduled_care (
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
        ) VALUES (
            v_request.group_id,
            v_response.responder_id, -- Parent B needs reciprocal care
            v_response.reciprocal_child_id,
            v_response.reciprocal_date,
            v_response.reciprocal_start_time,
            v_response.reciprocal_end_time,
            'needed',
            'confirmed',
            v_request.id,
            'Reciprocal care needed'
        );
        
        -- Create scheduled care block for Parent A providing reciprocal care
        INSERT INTO public.scheduled_care (
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
        ) VALUES (
            v_request.group_id,
            v_request.requester_id, -- Parent A provides reciprocal care
            v_response.reciprocal_child_id,
            v_response.reciprocal_date,
            v_response.reciprocal_start_time,
            v_response.reciprocal_end_time,
            'provided',
            'confirmed',
            v_request.id,
            'Reciprocal care provided'
        );
        
        RAISE NOTICE 'Created reciprocal care blocks: Parent B needs care, Parent A provides care';
    END IF;
    
    -- Mark response as accepted
    UPDATE care_responses 
    SET status = 'accepted'
    WHERE id = p_response_id;
    
    RAISE NOTICE 'Successfully created care exchange for request % and response %', p_request_id, p_response_id;
END;
$$;

GRANT EXECUTE ON FUNCTION create_care_exchange(UUID, UUID) TO authenticated; 