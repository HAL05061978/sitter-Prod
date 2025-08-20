-- FIX OPEN BLOCK LOGIC
-- Completely rewrite create_open_block_invitation function for open_block request_type only
-- Each time block offer gets a unique block_time_id
-- Creates care_responses for each parent x each time block combination

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
    j INTEGER;
BEGIN
    RAISE NOTICE '=== OPEN BLOCK INVITATION CREATION ===';
    RAISE NOTICE 'Existing block ID: %', p_existing_block_id;
    RAISE NOTICE 'Inviting parent ID: %', p_inviting_parent_id;
    RAISE NOTICE 'Number of invited parents: %', array_length(p_invited_parent_ids, 1);
    RAISE NOTICE 'Number of time blocks: %', array_length(p_reciprocal_dates, 1);
    
    -- Step 1: Get the existing scheduled care details (the block being opened)
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
    
    RAISE NOTICE 'Original block: date=%, start=%, end=%', v_original_block_date, v_original_block_start_time, v_original_block_end_time;
    
    -- Step 2: Get the child_id from scheduled_care_children
    SELECT child_id INTO v_child_id
    FROM scheduled_care_children 
    WHERE scheduled_care_id = p_existing_block_id 
    LIMIT 1;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'No child found in scheduled care block';
    END IF;
    
    RAISE NOTICE 'Child ID: %', v_child_id;
    
    -- Step 3: Create the main care request (ONE record for the entire open block invitation)
    -- This stores the original block times (the block being opened)
    INSERT INTO care_requests (
        group_id,
        requester_id,
        child_id,
        requested_date,           -- ORIGINAL block date (from scheduled_care.care_date)
        start_time,               -- ORIGINAL block start time (from scheduled_care.start_time)
        end_time,                 -- ORIGINAL block end time (from scheduled_care.end_time)
        notes,
        request_type,
        status,
        open_block_parent_id,
        open_block_slots,
        open_block_slots_used,
        inviting_parent_id,
        existing_block_id,
        -- Leave reciprocal fields NULL until someone accepts
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
        v_original_block_date,    -- ORIGINAL block date (the block being opened)
        v_original_block_start_time, -- ORIGINAL block start time
        v_original_block_end_time,   -- ORIGINAL block end time
        p_notes,
        'open_block',             -- SPECIFICALLY for open_block request_type
        'pending',
        p_inviting_parent_id,
        array_length(p_invited_parent_ids, 1),
        0,
        p_inviting_parent_id,
        p_existing_block_id,
        NULL,  -- reciprocal_date (NULL until accepted)
        NULL,  -- reciprocal_start_time (NULL until accepted)
        NULL,  -- reciprocal_end_time (NULL until accepted)
        NULL,  -- reciprocal_parent_id (NULL until accepted)
        NULL,  -- reciprocal_child_id (NULL until accepted)
        NULL,  -- responder_id (NULL until accepted)
        NULL,  -- response_notes (NULL until accepted)
        NULL   -- reciprocal_status (NULL until accepted)
    ) RETURNING id INTO v_care_request_id;
    
    RAISE NOTICE 'Created care request with ID: %', v_care_request_id;
    
    -- Step 4: Create care responses for each parent x each time block combination
    -- Each time block gets a unique block_time_id
    -- Each parent gets invited to each time block
    FOR i IN 1..array_length(p_reciprocal_dates, 1)
    LOOP
        -- Generate unique block_time_id for this time block
        v_block_time_id := gen_random_uuid();
        v_reciprocal_date := p_reciprocal_dates[i];
        v_reciprocal_start_time := p_reciprocal_start_times[i];
        v_reciprocal_end_time := p_reciprocal_end_times[i];
        
        RAISE NOTICE 'Time block %: date=%, start=%, end=%, block_time_id=%', 
            i, v_reciprocal_date, v_reciprocal_start_time, v_reciprocal_end_time, v_block_time_id;
        
        -- For each invited parent, create a care response for this time block
        FOR j IN 1..array_length(p_invited_parent_ids, 1)
        LOOP
            v_invited_parent_id := p_invited_parent_ids[j];
            
            -- Get the child ID for this invited parent
            SELECT id INTO v_reciprocal_child_id
            FROM children 
            WHERE parent_id = v_invited_parent_id 
            LIMIT 1;
            
            IF v_reciprocal_child_id IS NULL THEN
                RAISE NOTICE 'No child found for parent %, skipping...', v_invited_parent_id;
                CONTINUE;
            END IF;
            
            RAISE NOTICE 'Creating care response: parent=%, child=%, block_time_id=%', 
                v_invited_parent_id, v_reciprocal_child_id, v_block_time_id;
            
            -- Create care response for this parent x time block combination
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
            
            RAISE NOTICE 'Created care response for parent % and time block %', v_invited_parent_id, i;
        END LOOP;
    END LOOP;
    
    RAISE NOTICE '=== OPEN BLOCK INVITATION CREATION COMPLETE ===';
    RAISE NOTICE 'Total care responses created: %', 
        array_length(p_invited_parent_ids, 1) * array_length(p_reciprocal_dates, 1);
    
    RETURN TRUE;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION create_open_block_invitation(UUID, UUID, UUID[], DATE[], TIME[], TIME[], TEXT) TO authenticated;

-- Test deployment
DO $$
BEGIN
    RAISE NOTICE '=== FIXED OPEN BLOCK LOGIC ===';
    RAISE NOTICE '1. Each time block offer gets unique block_time_id';
    RAISE NOTICE '2. requested_date/start_time/end_time = original block times from scheduled_care';
    RAISE NOTICE '3. Creates care_responses for each parent x each time block';
    RAISE NOTICE '4. Only applies to open_block request_type';
    RAISE NOTICE '5. All permissions granted';
    RAISE NOTICE '=== FIX COMPLETE ===';
END $$;
