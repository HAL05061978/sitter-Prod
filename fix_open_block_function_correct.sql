-- CORRECT OPEN BLOCK FUNCTION WITH THIRD BLOCK FOR PARENT C
-- Use care_requests table as source of truth, populate related_request_id, and create 3 blocks total

DROP FUNCTION IF EXISTS accept_open_block_invitation(UUID, UUID, UUID);

CREATE OR REPLACE FUNCTION accept_open_block_invitation(
    p_care_response_id UUID,
    p_accepting_parent_id UUID,
    p_accepted_child_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_care_request_id UUID;
    v_care_request RECORD;
    v_block_time_id UUID;
    v_invited_parent_id UUID;
    v_reciprocal_date DATE;
    v_reciprocal_start_time TIME;
    v_reciprocal_end_time TIME;
    v_existing_block_date DATE;
    v_existing_block_start_time TIME;
    v_existing_block_end_time TIME;
    v_declined_count INTEGER;
BEGIN
    -- Get the care request ID from the care response
    SELECT request_id INTO v_care_request_id
    FROM care_responses 
    WHERE id = p_care_response_id
    AND status = 'pending';
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Care response not found or not in pending status';
    END IF;
    
    -- Get the complete care request details
    SELECT * INTO v_care_request
    FROM care_requests 
    WHERE id = v_care_request_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Care request not found';
    END IF;
    
    -- Verify this is an open block request
    IF v_care_request.request_type != 'open_block' THEN
        RAISE EXCEPTION 'Care request is not an open block request';
    END IF;
    
    -- Get the block_time_id and invited_parent_id from the care response being accepted
    -- These are needed for declining other responses
    SELECT block_time_id, invited_parent_id INTO v_block_time_id, v_invited_parent_id
    FROM care_responses 
    WHERE id = p_care_response_id;
    
    -- FIXED: For open block invitations, get reciprocal date/times from care_requests table
    -- Now that create_open_block_invitation properly stores the reciprocal times
    SELECT reciprocal_date, reciprocal_start_time, reciprocal_end_time INTO v_reciprocal_date, v_reciprocal_start_time, v_reciprocal_end_time
    FROM care_requests 
    WHERE id = v_care_request_id;
    
    -- Validate that we have the required reciprocal information
    IF v_reciprocal_date IS NULL OR v_reciprocal_start_time IS NULL OR v_reciprocal_end_time IS NULL THEN
        RAISE EXCEPTION 'Missing reciprocal date/time information in care request';
    END IF;
    
    -- Get the existing block times from scheduled_care table using existing_block_id
    -- This is needed for the care_requests update and for creating the third block
    IF v_care_request.existing_block_id IS NOT NULL THEN
        SELECT care_date, start_time, end_time INTO v_existing_block_date, v_existing_block_start_time, v_existing_block_end_time
        FROM scheduled_care 
        WHERE id = v_care_request.existing_block_id;
        
        IF NOT FOUND THEN
            RAISE EXCEPTION 'Existing scheduled care block not found';
        END IF;
        
        RAISE NOTICE 'Using reciprocal times from care_requests: date=%, start=%, end=%', 
            v_reciprocal_date, v_reciprocal_start_time, v_reciprocal_end_time;
        RAISE NOTICE 'Using existing block times from scheduled_care: date=%, start=%, end=%', 
            v_existing_block_date, v_existing_block_start_time, v_existing_block_end_time;
    ELSE
        RAISE EXCEPTION 'Missing existing_block_id in care request';
    END IF;
    
    -- Create scheduled_care records based on the care_requests data
    -- RULE: All time information comes from care_requests table
    -- RULE: reciprocal_parent_id should ALWAYS be providing care for the accepted reciprocal date/time
    -- RULE: requester_id should ALWAYS be receiving care for the accepted reciprocal date/time
    -- KEY: Populate related_request_id to link all blocks together
    
    -- 1. Parent C (accepting parent) providing care for the RECIPROCAL time (existing block time)
    -- This is where Parent C provides care in exchange for receiving care during the opened block
    INSERT INTO scheduled_care (
        group_id, care_date, start_time, end_time, care_type, status, notes, 
        parent_id, child_id, related_request_id
    ) VALUES (
        v_care_request.group_id, 
        v_reciprocal_date,                           -- Use reciprocal date/time from existing block
        v_reciprocal_start_time,                     -- Use reciprocal start time from existing block
        v_reciprocal_end_time,                       -- Use reciprocal end time from existing block
        'provided', 
        'confirmed', 
        v_care_request.notes || ' - Open block accepted - Parent C providing care', 
        p_accepting_parent_id,                       -- Parent C (the accepting parent) provides care
        p_accepted_child_id,                         -- Parent C's child
        v_care_request_id                            -- Link to the original care request!
    );
    
    -- 2. Original requester receiving care for the RECIPROCAL time (existing block time)
    -- This is where the original requester receives care from Parent C
    INSERT INTO scheduled_care (
        group_id, care_date, start_time, end_time, care_type, status, notes, 
        parent_id, child_id, related_request_id
    ) VALUES (
        v_care_request.group_id, 
        v_reciprocal_date,                           -- Use reciprocal date/time from existing block
        v_reciprocal_start_time,                     -- Use reciprocal start time from existing block
        v_reciprocal_end_time,                       -- Use reciprocal end time from existing block
        'needed', 
        'confirmed', 
        v_care_request.notes || ' - Open block accepted - requester receiving care from Parent C', 
        v_care_request.requester_id,                 -- The original requester receives care
        v_care_request.child_id,                     -- Their child
        v_care_request_id                            -- Link to the original care request!
    );
    
    -- 3. Parent C (accepting parent) receiving care for the ORIGINAL OPENED BLOCK time
    -- This ensures Parent C sees the opened block where they're receiving care
    INSERT INTO scheduled_care (
        group_id, care_date, start_time, end_time, care_type, status, notes, 
        parent_id, child_id, related_request_id
    ) VALUES (
        v_care_request.group_id, 
        v_care_request.requested_date,               -- Use ORIGINAL opened block date/time from care_requests
        v_care_request.start_time,                   -- Use ORIGINAL opened block start time from care_requests
        v_care_request.end_time,                     -- Use ORIGINAL opened block end time from care_requests
        'needed', 
        'confirmed', 
        v_care_request.notes || ' - Open block accepted - Parent C receiving care', 
        p_accepting_parent_id,                       -- Parent C (the accepting parent) receives care
        p_accepted_child_id,                         -- Parent C's child
        v_care_request_id                            -- Link to the original care request!
    );
    
    -- Update care_requests with accepting party information
    -- FIXED: Now we just need to fill in the accepting party details
    -- The reciprocal times are already stored correctly from create_open_block_invitation
    UPDATE care_requests 
    SET 
        status = 'accepted',
        responder_id = p_accepting_parent_id,
        response_notes = v_care_request.notes || ' - Open block accepted',
        -- Store the accepting party details
        reciprocal_parent_id = p_accepting_parent_id,
        reciprocal_child_id = p_accepted_child_id,
        reciprocal_status = 'accepted'
        -- Note: reciprocal_date, reciprocal_start_time, reciprocal_end_time are already set correctly
        -- from the create_open_block_invitation function
    WHERE id = v_care_request_id;
    
    -- Update the care response status to accepted
    UPDATE care_responses 
    SET status = 'accepted'
    WHERE id = p_care_response_id;
    
    -- Decline ONLY the specific time slot and parent that was accepted
    -- This prevents over-booking while keeping other time slots and parents available
    
    -- 1. Decline all responses for the same block_time_id (same time slot) EXCEPT the accepted one
    IF v_block_time_id IS NOT NULL THEN
        UPDATE care_responses 
        SET status = 'declined'
        WHERE block_time_id = v_block_time_id
        AND status = 'pending'
        AND id != p_care_response_id;
        
        GET DIAGNOSTICS v_declined_count = ROW_COUNT;
        RAISE NOTICE 'Declined % responses for block_time_id %', v_declined_count, v_block_time_id;
    END IF;
    
    -- 2. Decline all responses for the same invited_parent_id (same parent) EXCEPT the accepted one
    IF v_invited_parent_id IS NOT NULL THEN
        UPDATE care_responses 
        SET status = 'declined'
        WHERE invited_parent_id = v_invited_parent_id
        AND status = 'pending'
        AND id != p_care_response_id;
        
        GET DIAGNOSTICS v_declined_count = ROW_COUNT;
        RAISE NOTICE 'Declined % responses for invited_parent_id %', v_declined_count, v_invited_parent_id;
    END IF;
    
    -- STEP 3: Systematically add BOTH children to ALL blocks with the same related_request_id
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
            (v_care_request.child_id, p_accepting_parent_id, 'Requester child added to all blocks'),
            (p_accepted_child_id, p_accepting_parent_id, 'Reciprocal child added to all blocks')
    ) AS children(child_id, providing_parent_id, notes)
    WHERE sc.related_request_id = v_care_request_id
    -- Avoid duplicate children in the same block
    AND NOT EXISTS (
        SELECT 1 FROM scheduled_care_children scc 
        WHERE scc.scheduled_care_id = sc.id 
        AND scc.child_id = children.child_id
    );
    

    
    RAISE NOTICE 'Added children to appropriate blocks with related_request_id %', v_care_request_id;
    
    -- Debug: Log what was created
    RAISE NOTICE 'Created 3 scheduled_care records for open block %: % providing care, % receiving care, % receiving care (opened time)', 
        v_care_request_id, p_accepting_parent_id, v_care_request.requester_id, p_accepting_parent_id;
    
    RETURN TRUE;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Error in accept_open_block_invitation: %', SQLERRM;
        RAISE EXCEPTION 'Failed to accept open block invitation: %', SQLERRM;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION accept_open_block_invitation(UUID, UUID, UUID) TO authenticated;

-- Test deployment
DO $$
BEGIN
    RAISE NOTICE '=== CORRECT OPEN BLOCK FUNCTION WITH THIRD BLOCK ===';
    RAISE NOTICE '1. Uses care_requests table as source of truth';
    RAISE NOTICE '2. Populates related_request_id for all new scheduled_care records';
    RAISE NOTICE '3. Creates 3 blocks total: providing care, requester receiving, Parent C receiving';
    RAISE NOTICE '4. Systematically adds both children to ALL blocks with same related_request_id';
    RAISE NOTICE '5. Parent C now sees the opened block where they receive care';
    RAISE NOTICE '6. FIXED: Return type changed back to BOOLEAN for frontend compatibility';
    RAISE NOTICE '7. FIXED: Added proper error handling and debugging';
    RAISE NOTICE '8. FIXED: Corrected decline logic to exclude accepted response';
    RAISE NOTICE '9. FIXED: Corrected providing/receiving care logic (was reversed)';
    RAISE NOTICE '10. FIXED: Reciprocal times now come from care_requests table (properly stored by create_open_block_invitation)';
    RAISE NOTICE '11. FIXED: Accepting party details are filled in only when someone accepts';
    RAISE NOTICE '12. All permissions granted';
    RAISE NOTICE '=== DEPLOYMENT COMPLETE ===';
END $$;



