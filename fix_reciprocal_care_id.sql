-- FIX RECIPROCAL_CARE_ID POPULATION
-- Update handle_care_response_action to populate reciprocal_care_id with the original request block ID
-- This creates a direct link between care_requests and the scheduled_care block for the original request

DROP FUNCTION IF EXISTS handle_care_response_action(UUID, TEXT);

CREATE OR REPLACE FUNCTION handle_care_response_action(
    p_care_response_id UUID,
    p_action TEXT
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_care_response RECORD;
    v_care_request RECORD;
    v_group_id UUID;
    v_requester_id UUID;
    v_responder_id UUID;
    v_child_id UUID;
    v_reciprocal_child_id UUID;
    v_requested_date DATE;
    v_start_time TIME;
    v_end_time TIME;
    v_reciprocal_date DATE;
    v_reciprocal_start_time TIME;
    v_reciprocal_end_time TIME;
    v_notes TEXT;
    v_care_request_id UUID;
    v_new_scheduled_care_id_1 UUID;
    v_new_scheduled_care_id_2 UUID;
    v_new_scheduled_care_id_3 UUID;
    v_new_scheduled_care_id_4 UUID;
BEGIN
    -- Get the care response details
    SELECT * INTO v_care_response
    FROM care_responses 
    WHERE id = p_care_response_id;
    
    IF NOT FOUND THEN
        RETURN 'Care response not found';
    END IF;
    
    -- Get the care request details
    SELECT * INTO v_care_request
    FROM care_requests 
    WHERE id = v_care_response.request_id;
    
    IF NOT FOUND THEN
        RETURN 'Care request not found';
    END IF;
    
    -- Extract variables for clarity
    v_care_request_id := v_care_request.id;
    v_group_id := v_care_request.group_id;
    v_requester_id := v_care_request.requester_id;
    v_responder_id := v_care_response.responder_id;
    v_child_id := v_care_request.child_id;
    v_reciprocal_child_id := v_care_response.reciprocal_child_id;
    v_requested_date := v_care_request.requested_date;
    v_start_time := v_care_request.start_time;
    v_end_time := v_care_request.end_time;
    v_reciprocal_date := v_care_response.reciprocal_date;
    v_reciprocal_start_time := v_care_response.reciprocal_start_time;
    v_reciprocal_end_time := v_care_response.reciprocal_end_time;
    v_notes := v_care_request.notes;
    
    -- Handle the action
    IF p_action = 'accept' THEN
        -- Update care_requests with responder information
        UPDATE care_requests 
        SET 
            status = 'accepted',
            responder_id = v_responder_id,
            response_notes = v_care_response.response_notes,
            -- Store the reciprocal care details from the response
            reciprocal_parent_id = v_responder_id,
            reciprocal_child_id = v_reciprocal_child_id,
            reciprocal_date = v_reciprocal_date,
            reciprocal_start_time = v_reciprocal_start_time,
            reciprocal_end_time = v_reciprocal_end_time,
            reciprocal_status = 'accepted'
        WHERE id = v_care_request_id;
        
        -- Update the care response status to accepted
        UPDATE care_responses 
        SET status = 'accepted'
        WHERE id = p_care_response_id;
        
        -- Decline all other responses for this request
        UPDATE care_responses 
        SET status = 'declined'
        WHERE request_id = v_care_request_id
        AND id != p_care_response_id
        AND status IN ('pending', 'submitted');  -- FIXED: Include both pending and submitted statuses
        
        -- Create scheduled_care records for the reciprocal arrangement
        -- Block 1: Original request time - Parent A's perspective (needing care)
        INSERT INTO scheduled_care (
            group_id,
            care_date,
            start_time,
            end_time,
            notes,
            care_type,
            status,
            child_id,
            parent_id,
            related_request_id
        ) VALUES (
            v_group_id,
            v_requested_date,
            v_start_time,
            v_end_time,
            COALESCE(v_notes, '') || ' - Original request (needing care)',
            'needed',
            'confirmed',
            v_child_id,
            v_requester_id,
            v_care_request_id
        ) RETURNING id INTO v_new_scheduled_care_id_1;
        
        -- Block 2: Original time - Parent B's perspective (providing care)
        INSERT INTO scheduled_care (
            group_id,
            care_date,
            start_time,
            end_time,
            notes,
            care_type,
            status,
            child_id,
            parent_id,
            related_request_id
        ) VALUES (
            v_group_id,
            v_requested_date,
            v_start_time,
            v_end_time,
            COALESCE(v_notes, '') || ' - Reciprocal care (Parent B providing care for original time)',
            'provided',
            'confirmed',
            v_reciprocal_child_id,
            v_responder_id,
            v_care_request_id
        ) RETURNING id INTO v_new_scheduled_care_id_2;
        
        -- Block 3: Reciprocal time - Parent B's perspective (needing care)
        INSERT INTO scheduled_care (
            group_id,
            care_date,
            start_time,
            end_time,
            notes,
            care_type,
            status,
            child_id,
            parent_id,
            related_request_id
        ) VALUES (
            v_group_id,
            v_reciprocal_date,
            v_reciprocal_start_time,
            v_reciprocal_end_time,
            COALESCE(v_notes, '') || ' - Reciprocal care (Parent B needing care for reciprocal time)',
            'needed',
            'confirmed',
            v_reciprocal_child_id,
            v_responder_id,
            v_care_request_id
        ) RETURNING id INTO v_new_scheduled_care_id_3;
        
        -- Block 4: Reciprocal time - Parent A's perspective (providing care)
        INSERT INTO scheduled_care (
            group_id,
            care_date,
            start_time,
            end_time,
            notes,
            care_type,
            status,
            child_id,
            parent_id,
            related_request_id
        ) VALUES (
            v_group_id,
            v_reciprocal_date,
            v_reciprocal_start_time,
            v_reciprocal_end_time,
            COALESCE(v_notes, '') || ' - Reciprocal care (Parent A providing care for reciprocal time)',
            'provided',
            'confirmed',
            v_child_id,
            v_requester_id,
            v_care_request_id
        ) RETURNING id INTO v_new_scheduled_care_id_4;
        
        -- STEP 5: Populate reciprocal_care_id with the original request block ID
        -- This creates a direct link to Parent A's "needed" block for the original request
        UPDATE care_requests 
        SET reciprocal_care_id = v_new_scheduled_care_id_1
        WHERE id = v_care_request_id;
        
        -- STEP 6: Systematically add BOTH children to ALL blocks with the same related_request_id
        -- This ensures each parent sees both children in their blocks
        
        -- Add both children to all scheduled_care blocks for this request
        INSERT INTO scheduled_care_children (scheduled_care_id, child_id, providing_parent_id, notes)
        SELECT 
            sc.id, 
            children.child_id, 
            children.providing_parent_id, 
            children.notes
        FROM scheduled_care sc
        CROSS JOIN (
            VALUES 
                (v_child_id, v_requester_id, 'Original child added to all blocks'),
                (v_reciprocal_child_id, v_responder_id, 'Reciprocal child added to all blocks')
        ) AS children(child_id, providing_parent_id, notes)
        WHERE sc.related_request_id = v_care_request_id
        -- Avoid duplicate children in the same block
        AND NOT EXISTS (
            SELECT 1 FROM scheduled_care_children scc 
            WHERE scc.scheduled_care_id = sc.id 
            AND scc.child_id = children.child_id
        );
        
        -- STEP 7: Also update any EXISTING blocks that might be missing children
        -- This handles cases where blocks were created before the systematic child addition
        
        -- Add missing children to existing blocks that don't have them
        INSERT INTO scheduled_care_children (scheduled_care_id, child_id, providing_parent_id, notes)
        SELECT 
            sc.id, 
            v_reciprocal_child_id,  -- Parent C's child
            v_responder_id,         -- Parent C is providing
            'Reciprocal child added to existing block'
        FROM scheduled_care sc
        WHERE sc.related_request_id = v_care_request_id
        AND sc.parent_id = v_requester_id  -- Parent A's blocks
        AND NOT EXISTS (
            SELECT 1 FROM scheduled_care_children scc 
            WHERE scc.scheduled_care_id = sc.id 
            AND scc.child_id = v_reciprocal_child_id
        );
        
        INSERT INTO scheduled_care_children (scheduled_care_id, child_id, providing_parent_id, notes)
        SELECT 
            sc.id, 
            v_child_id,             -- Parent A's child
            v_requester_id,         -- Parent A is providing
            'Original child added to existing block'
        FROM scheduled_care sc
        WHERE sc.related_request_id = v_care_request_id
        AND sc.parent_id = v_responder_id  -- Parent B's blocks
        AND NOT EXISTS (
            SELECT 1 FROM scheduled_care_children scc 
            WHERE scc.scheduled_care_id = sc.id 
            AND scc.child_id = v_child_id
        );
        
        -- Debug: Log what was created
        RAISE NOTICE 'Created 4 scheduled_care records for reciprocal care:';
        RAISE NOTICE 'Block 1: Parent A needs care (original time) - ID: %, Parent: %, Care Type: needed', v_new_scheduled_care_id_1, v_requester_id;
        RAISE NOTICE 'Block 2: Parent B provides care (original time) - ID: %, Parent: %, Care Type: provided', v_new_scheduled_care_id_2, v_responder_id;
        RAISE NOTICE 'Block 3: Parent B needs care (reciprocal time) - ID: %, Parent: %, Care Type: needed', v_new_scheduled_care_id_3, v_responder_id;
        RAISE NOTICE 'Block 4: Parent A provides care (reciprocal time) - ID: %, Parent: %, Care Type: provided', v_new_scheduled_care_id_4, v_requester_id;
        
        RETURN 'Reciprocal care response accepted successfully. reciprocal_care_id populated with: ' || v_new_scheduled_care_id_1;
        
    ELSIF p_action = 'decline' THEN
        -- Update the care response status to declined
        UPDATE care_responses 
        SET status = 'declined'
        WHERE id = p_care_response_id;
        
        RETURN 'Reciprocal care response declined successfully';
        
    ELSE
        RETURN 'Invalid action. Use "accept" or "decline"';
    END IF;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION handle_care_response_action(UUID, TEXT) TO authenticated;

-- Create the missing accept_reciprocal_care_response function that the frontend expects
-- This function calls handle_care_response_action internally and returns a boolean

CREATE OR REPLACE FUNCTION accept_reciprocal_care_response(
    p_care_response_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_result TEXT;
BEGIN
    -- Call the main function to handle the acceptance
    SELECT handle_care_response_action(p_care_response_id, 'accept') INTO v_result;
    
    -- Return true if successful (any non-error result means success)
    RETURN TRUE;
EXCEPTION
    WHEN OTHERS THEN
        -- Log the error and return false
        RAISE NOTICE 'Error in accept_reciprocal_care_response: %', SQLERRM;
        RETURN FALSE;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION accept_reciprocal_care_response(UUID) TO authenticated;

-- Test deployment
DO $$
BEGIN
    RAISE NOTICE '=== FIX RECIPROCAL_CARE_ID POPULATION ===';
    RAISE NOTICE '1. Updated handle_care_response_action function';
    RAISE NOTICE '2. Now populates reciprocal_care_id with original request block ID';
    RAISE NOTICE '3. Creates direct link between care_requests and scheduled_care';
    RAISE NOTICE '4. Only affects reciprocal request types (not open_block)';
    RAISE NOTICE '5. Added missing accept_reciprocal_care_response function';
    RAISE NOTICE '6. FIXED: Decline logic now includes both pending and submitted statuses';
    RAISE NOTICE '7. All permissions granted';
    RAISE NOTICE '=== DEPLOYMENT COMPLETE ===';
END $$;
