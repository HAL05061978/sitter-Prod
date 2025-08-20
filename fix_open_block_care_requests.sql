-- FIX OPEN BLOCK CARE REQUESTS
-- Create multiple care_request records - one for each time block offer
-- Each time block gets its own care_request record for first-come-first-serve logic
-- Uses scheduled_care block data directly (from calendar double-click)

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
    RAISE NOTICE 'Parameter types check:';
    RAISE NOTICE 'p_existing_block_id (UUID): %', p_existing_block_id;
    RAISE NOTICE 'p_inviting_parent_id (UUID): %', p_inviting_parent_id;
    RAISE NOTICE 'p_invited_parent_ids (UUID[]): %', p_invited_parent_ids;
    RAISE NOTICE 'p_reciprocal_dates (DATE[]): %', p_reciprocal_dates;
    RAISE NOTICE 'p_reciprocal_start_times (TIME[]): %', p_reciprocal_start_times;
    RAISE NOTICE 'p_reciprocal_end_times (TIME[]): %', p_reciprocal_end_times;
    RAISE NOTICE 'p_notes (TEXT): %', p_notes;
    RAISE NOTICE 'Number of invited parents: %', array_length(p_invited_parent_ids, 1);
    RAISE NOTICE 'Number of time blocks: %', array_length(p_reciprocal_dates, 1);
    
    -- Step 1: Get the scheduled care block details (the block being opened from calendar)
    -- This is the scheduled_care block that was double-clicked in the calendar
    SELECT 
        sc.group_id,
        sc.care_date,
        sc.start_time,
        sc.end_time
    INTO 
        v_group_id,
        v_original_block_date, -- This will store the care_date from scheduled_care
        v_original_block_start_time, -- This will store the start_time from scheduled_care
        v_original_block_end_time    -- This will store the end_time from scheduled_care
    FROM scheduled_care sc
    WHERE sc.id = p_existing_block_id;  -- This is the scheduled_care ID from calendar double-click
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Scheduled care block not found';
    END IF;
    
    RAISE NOTICE 'Scheduled care block: date=%, start=%, end=%', 
        v_original_block_date, v_original_block_start_time, v_original_block_end_time;
    
    -- Step 2: Get the child_id from scheduled_care_children
    SELECT child_id INTO v_child_id
    FROM scheduled_care_children 
    WHERE scheduled_care_id = p_existing_block_id 
    LIMIT 1;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'No child found in scheduled care block';
    END IF;
    
    RAISE NOTICE 'Group ID: %, Parent ID: %, Child ID: %', v_group_id, p_inviting_parent_id, v_child_id;
    
    -- Step 3: Create care request records for EACH time block offer
    -- Each time block gets its own care_request record for first-come-first-serve logic
    FOR i IN 1..array_length(p_reciprocal_dates, 1)
    LOOP
        -- Generate unique block_time_id for this time block
        v_block_time_id := gen_random_uuid();
        v_reciprocal_date := p_reciprocal_dates[i];
        v_reciprocal_start_time := p_reciprocal_start_times[i];
        v_reciprocal_end_time := p_reciprocal_end_times[i];
        
        RAISE NOTICE 'Creating care request for time block %: date=%, start=%, end=%, block_time_id=%', 
            i, v_reciprocal_date, v_reciprocal_start_time, v_reciprocal_end_time, v_block_time_id;
        
        -- Create ONE care request record for this specific time block
        INSERT INTO care_requests (
            group_id,
            requester_id,
            child_id,
            requested_date,           -- SCHEDULED CARE date (from calendar block)
            start_time,               -- SCHEDULED CARE start time (from calendar block)
            end_time,                 -- SCHEDULED CARE end time (from calendar block)
            notes,
            request_type,
            status,
            open_block_parent_id,
            open_block_slots,
            open_block_slots_used,
            block_time_id,            -- UNIQUE block_time_id for this time block
            inviting_parent_id,
            existing_block_id,
            -- Store the reciprocal time being offered for this specific block
            reciprocal_date,          -- RECIPROCAL date for this time block
            reciprocal_start_time,    -- RECIPROCAL start time for this time block
            reciprocal_end_time,      -- RECIPROCAL end time for this time block
            -- Leave accepting party fields NULL until someone accepts
            reciprocal_parent_id,     -- NULL until accepted
            reciprocal_child_id,      -- NULL until accepted
            responder_id,             -- NULL until accepted
            response_notes,           -- NULL until accepted
            reciprocal_status         -- NULL until accepted
        )         VALUES (
            v_group_id,
            p_inviting_parent_id,     -- Parent from scheduled_care block
            v_child_id,
            v_original_block_date,    -- SCHEDULED CARE date (the block being opened)
            v_original_block_start_time, -- SCHEDULED CARE start time (the block being opened)
            v_original_block_end_time,   -- SCHEDULED CARE end time (the block being opened)
            p_notes,
            'open_block',             -- SPECIFICALLY for open_block request_type
            'pending',
            p_inviting_parent_id,
            array_length(p_invited_parent_ids, 1), -- Total slots available
            0,                        -- Slots used (starts at 0)
            v_block_time_id,          -- UNIQUE block_time_id for this time block
            p_inviting_parent_id,
            p_existing_block_id,
            v_reciprocal_date,        -- RECIPROCAL date for this time block
            v_reciprocal_start_time,  -- RECIPROCAL start time for this time block
            v_reciprocal_end_time,    -- RECIPROCAL end time for this time block
            NULL,  -- reciprocal_parent_id (NULL until accepted)
            NULL,  -- reciprocal_child_id (NULL until accepted)
            NULL,  -- responder_id (NULL until accepted)
            NULL,  -- response_notes (NULL until accepted)
            NULL   -- reciprocal_status (NULL until accepted)
        ) RETURNING id INTO v_care_request_id;
        
        RAISE NOTICE 'Created care request % for time block % with block_time_id %', v_care_request_id, i, v_block_time_id;
        
        -- Step 4: Create care responses for each invited parent for THIS time block
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
                v_care_request_id,    -- Links to the specific care_request for this time block
                v_invited_parent_id,
                'pending',
                'pending',
                v_invited_parent_id,
                v_block_time_id,      -- Same block_time_id as the care_request
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
    RAISE NOTICE 'Total care requests created: %', array_length(p_reciprocal_dates, 1);
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
    RAISE NOTICE '=== FIXED OPEN BLOCK CARE REQUESTS ===';
    RAISE NOTICE '1. Creates ONE care_request record for EACH time block offer';
    RAISE NOTICE '2. requested_date/start_time/end_time = scheduled_care times (from calendar block)';
    RAISE NOTICE '3. Each care_request has unique block_time_id and offered reciprocal times';
    RAISE NOTICE '4. First-come-first-serve logic: each time block can be claimed independently';
    RAISE NOTICE '5. All permissions granted';
    RAISE NOTICE '=== FIX COMPLETE ===';
END $$;
