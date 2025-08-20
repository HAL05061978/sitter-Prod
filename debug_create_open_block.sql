-- DEBUG CREATE OPEN BLOCK INVITATION
-- Simplified version to identify the child_id column error

DROP FUNCTION IF EXISTS create_open_block_invitation(UUID, UUID, UUID[], DATE[], TIME[], TIME[], TEXT);

CREATE OR REPLACE FUNCTION create_open_block_invitation(
    p_existing_block_id UUID,
    p_inviting_parent_id UUID,
    p_invited_parent_ids UUID[],
    p_reciprocal_dates DATE[],
    p_reciprocal_start_times TIME[],
    p_reciprocal_end_times TIME[],
    p_notes TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_care_request_id UUID;
    v_group_id UUID;
    v_child_id UUID;
    v_original_block_date DATE;
    v_original_block_start_time TIME;
    v_original_block_end_time TIME;
    v_block_time_id UUID;
    v_invited_parent_id UUID;
    v_reciprocal_date DATE;
    v_reciprocal_start_time TIME;
    v_reciprocal_end_time TIME;
    v_reciprocal_child_id UUID;
    i INTEGER;
BEGIN
    RAISE NOTICE '=== DEBUG: Starting create_open_block_invitation ===';
    RAISE NOTICE 'p_existing_block_id: %', p_existing_block_id;
    RAISE NOTICE 'p_inviting_parent_id: %', p_inviting_parent_id;
    
    -- Step 1: Get the existing scheduled care details
    RAISE NOTICE 'Step 1: Getting scheduled care details...';
    SELECT 
        group_id,
        parent_id,
        care_date,
        start_time,
        end_time
    INTO 
        v_group_id,
        v_child_id, -- This will be parent_id, we'll get child_id from scheduled_care_children
        v_original_block_date,
        v_original_block_start_time,
        v_original_block_end_time
    FROM scheduled_care 
    WHERE id = p_existing_block_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Scheduled care block not found';
    END IF;
    
    RAISE NOTICE 'Step 1 complete: group_id=%, parent_id=%, date=%, start=%, end=%', 
        v_group_id, v_child_id, v_original_block_date, v_original_block_start_time, v_original_block_end_time;
    
    -- Step 2: Get the child_id from scheduled_care_children
    RAISE NOTICE 'Step 2: Getting child_id from scheduled_care_children...';
    SELECT child_id INTO v_child_id
    FROM scheduled_care_children 
    WHERE scheduled_care_id = p_existing_block_id 
    LIMIT 1;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'No child found in scheduled care block';
    END IF;
    
    RAISE NOTICE 'Step 2 complete: child_id=%', v_child_id;
    
    -- Step 3: Generate block_time_id
    v_block_time_id := gen_random_uuid();
    RAISE NOTICE 'Step 3 complete: block_time_id=%', v_block_time_id;
    
    -- Step 4: Create the main care request
    RAISE NOTICE 'Step 4: Creating care request...';
    INSERT INTO care_requests (
        group_id,
        requester_id,
        child_id,
        requested_date,
        start_time,
        end_time,
        notes,
        request_type,
        status,
        open_block_parent_id,
        open_block_slots,
        open_block_slots_used,
        block_time_id,
        inviting_parent_id,
        existing_block_id,
        reciprocal_date,
        reciprocal_start_time,
        reciprocal_end_time,
        reciprocal_parent_id,
        reciprocal_child_id,
        responder_id,
        response_notes,
        reciprocal_status
    ) VALUES (
        v_group_id,
        p_inviting_parent_id,
        v_child_id,
        v_original_block_date,
        v_original_block_start_time,
        v_original_block_end_time,
        p_notes,
        'open_block',
        'pending',
        p_inviting_parent_id,
        array_length(p_invited_parent_ids, 1),
        0,
        v_block_time_id,
        p_inviting_parent_id,
        p_existing_block_id,
        p_reciprocal_dates[1],
        p_reciprocal_start_times[1],
        p_reciprocal_end_times[1],
        NULL,
        NULL,
        NULL,
        NULL,
        NULL
    ) RETURNING id INTO v_care_request_id;
    
    RAISE NOTICE 'Step 4 complete: care_request_id=%', v_care_request_id;
    
    -- Step 5: Create care responses for each invited parent
    RAISE NOTICE 'Step 5: Creating care responses...';
    FOR i IN 1..array_length(p_invited_parent_ids, 1)
    LOOP
        v_invited_parent_id := p_invited_parent_ids[i];
        v_reciprocal_date := p_reciprocal_dates[i];
        v_reciprocal_start_time := p_reciprocal_start_times[i];
        v_reciprocal_end_time := p_reciprocal_end_times[i];
        
        RAISE NOTICE 'Processing invited parent %: parent_id=%, date=%, start=%, end=%', 
            i, v_invited_parent_id, v_reciprocal_date, v_reciprocal_start_time, v_reciprocal_end_time;
        
        -- Get the child ID for this invited parent
        SELECT id INTO v_reciprocal_child_id
        FROM children 
        WHERE parent_id = v_invited_parent_id 
        LIMIT 1;
        
        IF v_reciprocal_child_id IS NULL THEN
            RAISE NOTICE 'No child found for parent %, skipping...', v_invited_parent_id;
            CONTINUE;
        END IF;
        
        RAISE NOTICE 'Found child_id=% for parent %', v_reciprocal_child_id, v_invited_parent_id;
        
        -- Insert care response
        INSERT INTO care_responses (
            request_id,
            responder_id,
            response_type,
            status,
            invited_parent_id,
            block_time_id,
            response_notes,
            reciprocal_date,
            reciprocal_start_time,
            reciprocal_end_time,
            reciprocal_child_id
        ) VALUES (
            v_care_request_id,
            v_invited_parent_id,
            'pending',
            'pending',
            v_invited_parent_id,
            v_block_time_id,
            'Open block invitation',
            v_reciprocal_date,
            v_reciprocal_start_time,
            v_reciprocal_end_time,
            v_reciprocal_child_id
        );
        
        RAISE NOTICE 'Created care response for parent %', v_invited_parent_id;
    END LOOP;
    
    RAISE NOTICE '=== DEBUG: Function completed successfully ===';
    RETURN TRUE;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION create_open_block_invitation(UUID, UUID, UUID[], DATE[], TIME[], TIME[], TEXT) TO authenticated;

-- Test deployment
DO $$
BEGIN
    RAISE NOTICE '=== DEBUG CREATE OPEN BLOCK INVITATION ===';
    RAISE NOTICE '1. Added debug logging to identify child_id error';
    RAISE NOTICE '2. Function will show exactly where the error occurs';
    RAISE NOTICE '3. All permissions granted';
    RAISE NOTICE '=== DEBUG VERSION READY ===';
END $$;
