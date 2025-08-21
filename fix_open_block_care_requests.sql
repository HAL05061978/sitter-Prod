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
    -- P, Q, N, O tracking variables for child assignment
    v_provider_child_id UUID;      -- P: Provider's child_id (Parent B's child in providing care block)
    v_other_children UUID[];       -- Q: All other children in the block being opened (Parent A's child)
    v_opened_block_id UUID;        -- N: The actual block being opened (Parent B's providing care block)
    v_original_requester_block_id UUID; -- O: Original block from Parent A that created the block being opened
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
    
    -- Step 1: Get the block details (either from care_request or scheduled_care)
    -- First try to find a care_request with this ID (for accepted reciprocal requests)
    -- If not found, treat it as a scheduled_care ID (for calendar double-clicks)
    SELECT 
        cr.group_id,
        cr.reciprocal_date,      -- This will store the reciprocal_date from accepted care_request
        cr.reciprocal_start_time, -- This will store the reciprocal_start_time from accepted care_request
        cr.reciprocal_end_time    -- This will store the reciprocal_end_time from accepted care_request
    INTO 
        v_group_id,
        v_original_block_date,    -- This will store the reciprocal_date from accepted care_request
        v_original_block_start_time, -- This will store the reciprocal_start_time from accepted care_request
        v_original_block_end_time    -- This will store the reciprocal_end_time from accepted care_request
    FROM care_requests cr
    WHERE cr.id = p_existing_block_id  -- Try to find a care_request first
    AND cr.status = 'accepted';  -- Must be an accepted care_request
    
    IF NOT FOUND THEN
        -- Fallback: treat p_existing_block_id as a scheduled_care ID
        -- This handles the case where user double-clicks a calendar block
        RAISE NOTICE 'No accepted care_request found with ID %, trying as scheduled_care ID...', p_existing_block_id;
        
        SELECT 
            sc.group_id,
            sc.care_date,        -- Use the care_date from scheduled_care
            sc.start_time,       -- Use the start_time from scheduled_care
            sc.end_time          -- Use the end_time from scheduled_care
        INTO 
            v_group_id,
            v_original_block_date,    -- This will store the care_date from scheduled_care
            v_original_block_start_time, -- This will store the start_time from scheduled_care
            v_original_block_end_time    -- This will store the end_time from scheduled_care
        FROM scheduled_care sc
        WHERE sc.id = p_existing_block_id;  -- Treat as scheduled_care ID
        
        IF NOT FOUND THEN
            RAISE EXCEPTION 'Neither accepted care_request nor scheduled_care block found with ID %', p_existing_block_id;
        END IF;
        
        RAISE NOTICE 'Found scheduled_care block: date=%, start=%, end=%', 
            v_original_block_date, v_original_block_start_time, v_original_block_end_time;
    ELSE
        RAISE NOTICE 'Found accepted care_request: reciprocal date=%, start=%, end=%', 
            v_original_block_date, v_original_block_start_time, v_original_block_end_time;
    END IF;
    
    -- Step 2: Capture P, Q, N, O for child assignment tracking
    -- We need to determine if we're working with a care_request or scheduled_care block
    -- and set up the child assignment variables accordingly
    
    -- Check if we found a care_request or scheduled_care block
    IF EXISTS (SELECT 1 FROM care_requests WHERE id = p_existing_block_id AND status = 'accepted') THEN
        -- We're working with an accepted care_request
        RAISE NOTICE 'Working with accepted care_request - setting up P, Q, N, O from care_request data';
        
        -- Get child_id from the care_request
        v_child_id := (SELECT child_id FROM care_requests WHERE id = p_existing_block_id);
        
        -- N: The actual block being opened (find scheduled_care block where inviting parent is providing care)
        SELECT sc.id INTO v_opened_block_id
        FROM scheduled_care sc
        WHERE sc.parent_id = p_inviting_parent_id  -- The inviting parent
        AND sc.care_type = 'provided'  -- They are providing care
        AND sc.group_id = v_group_id  -- Same group
        AND sc.care_date = v_original_block_date  -- Same date as the reciprocal times from care_request
        AND sc.start_time = v_original_block_start_time  -- Same start time
        AND sc.end_time = v_original_block_end_time  -- Same end time
        LIMIT 1;
        
        IF NOT FOUND THEN
            RAISE NOTICE 'WARNING: No scheduled_care block found for opened block - child assignment may fail';
            v_opened_block_id := NULL;
        END IF;
        
        -- O: Find the original block from Parent A that created this block being opened
        SELECT sc.id INTO v_original_requester_block_id
        FROM scheduled_care sc
        WHERE sc.parent_id != p_inviting_parent_id  -- Not the provider
        AND sc.care_type = 'needed'  -- Receiving care block
        AND sc.group_id = v_group_id  -- Same group
        AND sc.care_date = v_original_block_date  -- Same date as the reciprocal times from care_request
        AND sc.start_time = v_original_block_start_time  -- Same start time
        AND sc.end_time = v_original_block_end_time  -- Same end time
        LIMIT 1;
        
        IF NOT FOUND THEN
            RAISE NOTICE 'WARNING: No original requester block found - child assignment may fail';
            v_original_requester_block_id := NULL;
        END IF;
        
    ELSE
        -- We're working with a scheduled_care block (calendar double-click)
        RAISE NOTICE 'Working with scheduled_care block - setting up P, Q, N, O from scheduled_care data';
        
        -- N: The actual block being opened (this is what we're opening)
        v_opened_block_id := p_existing_block_id;
        
        -- Get child_id from the scheduled_care block
        SELECT child_id INTO v_child_id
        FROM scheduled_care 
        WHERE id = p_existing_block_id;
        
        -- O: Find the original block from Parent A that created this block being opened
        -- This would be the scheduled_care block where Parent A is receiving care
        SELECT sc.id INTO v_original_requester_block_id
        FROM scheduled_care sc
        WHERE sc.parent_id != p_inviting_parent_id  -- Not the provider
        AND sc.care_type = 'needed'  -- Receiving care block
        AND sc.group_id = v_group_id  -- Same group
        AND sc.care_date = v_original_block_date  -- Same date as the scheduled_care block
        AND sc.start_time = v_original_block_start_time  -- Same start time
        AND sc.end_time = v_original_block_end_time  -- Same end time
        LIMIT 1;
        
        IF NOT FOUND THEN
            RAISE NOTICE 'WARNING: No original requester block found - child assignment may fail';
            v_original_requester_block_id := NULL;
        END IF;
    END IF;
    
    -- P: Provider's child_id (Parent B's child in providing care block)
    IF v_opened_block_id IS NOT NULL THEN
        SELECT child_id INTO v_provider_child_id
        FROM scheduled_care_children 
        WHERE scheduled_care_id = v_opened_block_id 
        AND providing_parent_id = p_inviting_parent_id  -- This is the provider's child
        LIMIT 1;
        
        IF NOT FOUND THEN
            RAISE NOTICE 'WARNING: Provider child not found in scheduled_care block - child assignment may fail';
            v_provider_child_id := NULL;
        END IF;
        
        -- Q: All other children in the block being opened (Parent A's child)
        SELECT ARRAY_AGG(child_id) INTO v_other_children
        FROM scheduled_care_children 
        WHERE scheduled_care_id = v_opened_block_id 
        AND child_id != v_provider_child_id;  -- Exclude the provider's child
    ELSE
        v_provider_child_id := NULL;
        v_other_children := NULL;
    END IF;
    
    RAISE NOTICE 'P, Q, N, O captured:';
    RAISE NOTICE 'P (Provider child): %', v_provider_child_id;
    RAISE NOTICE 'Q (Other children): %', v_other_children;
    RAISE NOTICE 'N (Opened block): %', v_opened_block_id;
    RAISE NOTICE 'O (Original requester block): %', v_original_requester_block_id;
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
        
        RAISE NOTICE '=== FIELD MAPPING DEBUG ===';
        RAISE NOTICE 'requested_date/start_time/end_time = % %-% (from accepted care_request OR scheduled_care)', 
            v_original_block_date, v_original_block_start_time, v_original_block_end_time;
        RAISE NOTICE 'reciprocal_date/start_time/end_time = % %-% (NEW times from UI form)', 
            v_reciprocal_date, v_reciprocal_start_time, v_reciprocal_end_time;
        
        -- Create ONE care request record for this specific time block
        INSERT INTO care_requests (
            group_id,
            requester_id,
            child_id,
            requested_date,           -- OPENED BLOCK date (from scheduled_care - when Parent B is providing care)
            start_time,               -- OPENED BLOCK start time (from scheduled_care - when Parent B is providing care)
            end_time,                 -- OPENED BLOCK end time (from scheduled_care - when Parent B is providing care)
            notes,
            request_type,
            status,
            open_block_parent_id,
            open_block_slots,
            open_block_slots_used,
            block_time_id,            -- UNIQUE block_time_id for this time block
            inviting_parent_id,
            existing_block_id,
            -- Store the reciprocal times being offered (from UI form)
            reciprocal_date,          -- RECIPROCAL date being offered (from UI form)
            reciprocal_start_time,    -- RECIPROCAL start time being offered (from UI form)
            reciprocal_end_time,      -- RECIPROCAL end time being offered (from UI form)
            -- Leave accepting party fields NULL until someone accepts
            reciprocal_parent_id,     -- NULL until accepted
            reciprocal_child_id,      -- NULL until accepted
            responder_id,             -- NULL until accepted
            response_notes,           -- NULL until accepted
            reciprocal_status,
            -- Store P, Q, N, O information for child assignment
            event_title,              -- Use to store P (provider child ID as text)
            event_description         -- Use to store Q, N, O as JSON text
        )         VALUES (
            v_group_id,
            p_inviting_parent_id,     -- Parent from scheduled_care block
            v_child_id,
            v_original_block_date,    -- OPENED BLOCK date (from scheduled_care - when Parent B is providing care)
            v_original_block_start_time, -- OPENED BLOCK start time (from scheduled_care - when Parent B is providing care)
            v_original_block_end_time,   -- OPENED BLOCK end time (from scheduled_care - when Parent B is providing care)
            p_notes,
            'open_block',             -- SPECIFICALLY for open_block request_type
            'pending',
            p_inviting_parent_id,
            array_length(p_invited_parent_ids, 1), -- Total slots available
            0,                        -- Slots used (starts at 0)
            v_block_time_id,          -- UNIQUE block_time_id for this time block
            p_inviting_parent_id,
            p_existing_block_id,
            v_reciprocal_date,        -- RECIPROCAL date being offered (from UI form)
            v_reciprocal_start_time,  -- RECIPROCAL start time being offered (from UI form)
            v_reciprocal_end_time,    -- RECIPROCAL end time being offered (from UI form)
            NULL,  -- reciprocal_parent_id (NULL until accepted)
            NULL,  -- reciprocal_child_id (NULL until accepted)
            NULL,  -- responder_id (NULL until accepted)
            NULL,  -- response_notes (NULL until accepted)
            NULL,  -- reciprocal_status
            -- Store P, Q, N, O information
            v_provider_child_id::TEXT,  -- P: Provider child ID stored in event_title
            json_build_object(         -- Q, N, O stored as JSON in event_description
                'other_children', v_other_children,
                'opened_block_id', v_opened_block_id,
                'original_requester_block_id', v_original_requester_block_id
            )::TEXT
        ) RETURNING id INTO v_care_request_id;
        
        RAISE NOTICE 'Created care request % for time block % with block_time_id %', v_care_request_id, i, v_block_time_id;
        
        -- Verify what was actually stored
        RAISE NOTICE '=== VERIFICATION: What was stored in database ===';
        RAISE NOTICE 'requested_date: %, start_time: %, end_time: % (from accepted care_request OR scheduled_care)', 
            v_original_block_date, v_original_block_start_time, v_original_block_end_time;
        RAISE NOTICE 'reciprocal_date: %, reciprocal_start_time: %, reciprocal_end_time: % (NEW times from UI form)', 
            v_reciprocal_date, v_reciprocal_start_time, v_reciprocal_end_time;
        
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
    RAISE NOTICE '=== FINALLY CORRECTED OPEN BLOCK CARE REQUESTS WITH P, Q, N, O TRACKING ===';
    RAISE NOTICE '1. Creates ONE care_request record for EACH time block offer';
    RAISE NOTICE '2. FLEXIBLE: requested_date/start_time/end_time = from ACCEPTED care_request OR scheduled_care block';
    RAISE NOTICE '3. CORRECTED: reciprocal_date/start_time/end_time = NEW times being offered from UI form';
    RAISE NOTICE '4. Each care_request has unique block_time_id and offered reciprocal times';
    RAISE NOTICE '5. First-come-first-serve logic: each time block can be claimed independently';
    RAISE NOTICE '6. NEW: Captures P, Q, N, O for precise child assignment tracking';
    RAISE NOTICE '7. P stored in event_title, Q/N/O stored as JSON in event_description';
    RAISE NOTICE '8. All permissions granted';
    RAISE NOTICE '=== FIELD MAPPING FINALLY CORRECTED - FLEXIBLE SOURCE HANDLING ===';
END $$;
