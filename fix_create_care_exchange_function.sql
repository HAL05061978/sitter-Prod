-- Fix create_care_exchange function for new 3-table schema
-- This function is called when Parent A accepts Parent B's response to create scheduled care blocks

-- ============================================================================
-- STEP 1: CREATE THE MISSING create_care_exchange FUNCTION
-- ============================================================================

-- Drop the old function if it exists (it might reference old table names)
DROP FUNCTION IF EXISTS create_care_exchange(UUID, UUID);

-- Create the new create_care_exchange function for the 3-table schema
CREATE OR REPLACE FUNCTION create_care_exchange(
    p_request_id UUID,
    p_response_id UUID
) RETURNS VOID AS $$
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
    
    -- Calculate reciprocal duration if provided
    IF v_response.reciprocal_start_time IS NOT NULL AND v_response.reciprocal_end_time IS NOT NULL THEN
        v_reciprocal_duration_minutes := EXTRACT(EPOCH FROM (v_response.reciprocal_end_time::time - v_response.reciprocal_start_time::time)) / 60;
    ELSE
        v_reciprocal_duration_minutes := v_request.duration_minutes;
    END IF;
    
    -- Create scheduled care block for Parent A needing care (original request)
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
        notes,
        edit_deadline
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
        v_request.notes,
        v_request.requested_date - INTERVAL '24 hours'
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
        notes,
        edit_deadline
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
        v_response.response_notes,
        v_request.requested_date - INTERVAL '24 hours'
    );
    
    -- If this is a reciprocal response, create the reciprocal care blocks
    IF v_response.response_type = 'accept' AND v_response.reciprocal_date IS NOT NULL THEN
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
            notes,
            edit_deadline
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
            'Reciprocal care needed',
            v_response.reciprocal_date - INTERVAL '24 hours'
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
            notes,
            edit_deadline
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
            'Reciprocal care provided',
            v_response.reciprocal_date - INTERVAL '24 hours'
        );
    END IF;
    
    -- Update the response status to accepted
    UPDATE public.care_responses 
    SET status = 'accepted'
    WHERE id = p_response_id;
    
    -- Update the request status to accepted
    UPDATE public.care_requests 
    SET status = 'accepted',
        responder_id = v_response.responder_id,
        response_notes = v_response.response_notes,
        updated_at = now()
    WHERE id = p_request_id;
    
    -- Expire other pending responses for this request
    UPDATE public.care_responses 
    SET status = 'expired'
    WHERE request_id = p_request_id 
    AND id != p_response_id
    AND status = 'pending';
    
    RAISE NOTICE 'Successfully created care exchange for request % and response %', p_request_id, p_response_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION create_care_exchange(UUID, UUID) TO authenticated;

-- ============================================================================
-- STEP 2: VERIFY THE FUNCTION WAS CREATED SUCCESSFULLY
-- ============================================================================

SELECT 
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.routines 
            WHERE routine_name = 'create_care_exchange'
            AND routine_schema = 'public'
        ) THEN '✅ PASS: create_care_exchange function created successfully'
        ELSE '❌ FAIL: create_care_exchange function creation failed'
    END as function_creation_status;

-- ============================================================================
-- STEP 3: TEST THE FUNCTION WITH SAMPLE DATA (OPTIONAL)
-- ============================================================================

-- This section can be used to test the function if you have sample data
-- Uncomment and modify the test data as needed

/*
-- Test the function (replace with actual UUIDs from your database)
DO $$
DECLARE
    v_test_request_id UUID;
    v_test_response_id UUID;
BEGIN
    -- Get a sample request and response for testing
    SELECT id INTO v_test_request_id FROM public.care_requests LIMIT 1;
    SELECT id INTO v_test_response_id FROM public.care_responses LIMIT 1;
    
    IF v_test_request_id IS NOT NULL AND v_test_response_id IS NOT NULL THEN
        RAISE NOTICE 'Testing create_care_exchange with request % and response %', v_test_request_id, v_test_response_id;
        PERFORM create_care_exchange(v_test_request_id, v_test_response_id);
        RAISE NOTICE 'Test completed successfully';
    ELSE
        RAISE NOTICE 'No test data available';
    END IF;
END $$;
*/

SELECT 'create_care_exchange function has been created and is ready to use!' as status; 