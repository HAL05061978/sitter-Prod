-- FIX CARE RESPONSES COLUMNS
-- Remove child_id column from care_responses INSERT since it doesn't exist in the table

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
    -- Get the existing scheduled care details (this is the ORIGINAL block being opened)
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
    
    -- Get the child_id from scheduled_care_children (assuming one child per block for now)
    SELECT child_id INTO v_child_id
    FROM scheduled_care_children 
    WHERE scheduled_care_id = p_existing_block_id 
    LIMIT 1;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'No child found in scheduled care block';
    END IF;
    
    -- Generate a unique block_time_id for this time block
    v_block_time_id := gen_random_uuid();
    
    -- FIXED: Create the main care request with proper time storage (removed duration_minutes)
    -- requested_date/start_time/end_time = ORIGINAL block times (the block being opened)
    -- reciprocal_date/start_time/end_time = RECIPROCAL times (the times being offered)
    -- Leave accepting party fields NULL until someone accepts
    INSERT INTO care_requests (
        group_id,
        requester_id,
        child_id,
        requested_date,           -- ORIGINAL block date (the block being opened)
        start_time,               -- ORIGINAL block start time
        end_time,                 -- ORIGINAL block end time
        notes,
        request_type,
        status,
        open_block_parent_id,
        open_block_slots,
        open_block_slots_used,
        block_time_id,
        inviting_parent_id,
        existing_block_id,
        -- FIXED: Store reciprocal times (the times being offered in exchange)
        reciprocal_date,          -- RECIPROCAL date (first offered time)
        reciprocal_start_time,    -- RECIPROCAL start time (first offered time)
        reciprocal_end_time,      -- RECIPROCAL end time (first offered time)
        -- Leave accepting party fields NULL until someone accepts
        reciprocal_parent_id,     -- NULL until accepted
        reciprocal_child_id,      -- NULL until accepted
        responder_id,             -- NULL until accepted
        response_notes,           -- NULL until accepted
        reciprocal_status         -- NULL until accepted
    ) VALUES (
        v_group_id,
        p_inviting_parent_id,
        v_child_id,
        v_original_block_date,    -- ORIGINAL block date (the block being opened)
        v_original_block_start_time, -- ORIGINAL block start time
        v_original_block_end_time,   -- ORIGINAL block end time
        p_notes,
        'open_block',
        'pending',
        p_inviting_parent_id,
        array_length(p_invited_parent_ids, 1),
        0,
        v_block_time_id,
        p_inviting_parent_id,
        p_existing_block_id,
        -- FIXED: Store first reciprocal time (the time being offered in exchange)
        p_reciprocal_dates[1],        -- First reciprocal date
        p_reciprocal_start_times[1],  -- First reciprocal start time
        p_reciprocal_end_times[1],    -- First reciprocal end time
        NULL,  -- reciprocal_parent_id (NULL until accepted)
        NULL,  -- reciprocal_child_id (NULL until accepted)
        NULL,  -- responder_id (NULL until accepted)
        NULL,  -- response_notes (NULL until accepted)
        NULL   -- reciprocal_status (NULL until accepted)
    ) RETURNING id INTO v_care_request_id;
    
    -- Create care responses for each invited parent
    FOR i IN 1..array_length(p_invited_parent_ids, 1)
    LOOP
        v_invited_parent_id := p_invited_parent_ids[i];
        v_reciprocal_date := p_reciprocal_dates[i];
        v_reciprocal_start_time := p_reciprocal_start_times[i];
        v_reciprocal_end_time := p_reciprocal_end_times[i];
        
        -- FIXED: Get the child ID for this invited parent from children table
        -- Use 'id' column instead of 'child_id' since that's the primary key
        SELECT id INTO v_reciprocal_child_id
        FROM children 
        WHERE parent_id = v_invited_parent_id 
        LIMIT 1;
        
        -- If no child found, skip this invitation or use a default
        IF v_reciprocal_child_id IS NULL THEN
            RAISE NOTICE 'No child found for parent %', v_invited_parent_id;
            CONTINUE;
        END IF;
        
        -- FIXED: Insert into care_responses with correct columns (removed child_id)
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
            'pending',  -- FIXED: Changed from 'open_block_invitation' to 'pending'
            'pending',
            v_invited_parent_id,
            v_block_time_id,
            'Open block invitation',
            v_reciprocal_date,
            v_reciprocal_start_time,
            v_reciprocal_end_time,
            v_reciprocal_child_id
        );
    END LOOP;
    
    RETURN TRUE;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION create_open_block_invitation(UUID, UUID, UUID[], DATE[], TIME[], TIME[], TEXT) TO authenticated;

-- Test deployment
DO $$
BEGIN
    RAISE NOTICE '=== FIXED CARE RESPONSES COLUMNS ===';
    RAISE NOTICE '1. Removed child_id column from care_responses INSERT';
    RAISE NOTICE '2. care_responses table has reciprocal_child_id, not child_id';
    RAISE NOTICE '3. Function should now work without column error';
    RAISE NOTICE '4. All permissions granted';
    RAISE NOTICE '=== FIX COMPLETE ===';
END $$;
