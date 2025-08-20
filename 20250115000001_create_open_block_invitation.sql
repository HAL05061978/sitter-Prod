-- Create Open Block Invitation Function
-- This function creates open block invitations without populating reciprocal data when pending

-- Drop existing function first to avoid conflicts
DROP FUNCTION IF EXISTS create_open_block_invitation(UUID, UUID, UUID, DATE, TIME, TIME, TEXT, UUID[], DATE, TIME, TIME, UUID);

CREATE OR REPLACE FUNCTION create_open_block_invitation(
    p_existing_block_id UUID,
    p_inviting_parent_id UUID,
    p_invited_parent_ids UUID[],
    p_reciprocal_dates DATE[],
    p_reciprocal_start_times TIME[],
    p_reciprocal_end_times TIME[],
    p_notes TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_care_request_id UUID;
    v_scheduled_care_id UUID;
    v_block_time_id UUID;
    v_invited_parent_id UUID;
    v_duration_minutes INTEGER;
    v_group_id UUID;
    v_child_id UUID;
    v_care_date DATE;
    v_start_time TIME;
    v_end_time TIME;
    v_reciprocal_date DATE;
    v_reciprocal_start_time TIME;
    v_reciprocal_end_time TIME;
    v_reciprocal_child_id UUID;
    i INTEGER;
BEGIN
    -- Get the existing scheduled care details
    SELECT 
        group_id,
        parent_id,
        care_date,
        start_time,
        end_time,
        duration_minutes
    INTO 
        v_group_id,
        v_child_id, -- This will be parent_id, we'll get child_id from scheduled_care_children
        v_care_date,
        v_start_time,
        v_end_time,
        v_duration_minutes
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
    
    -- Create the main care request (without reciprocal data when pending)
    INSERT INTO care_requests (
        group_id,
        requester_id,
        child_id,
        requested_date,
        start_time,
        end_time,
        duration_minutes,
        notes,
        request_type,
        status,
        open_block_parent_id,
        open_block_slots,
        open_block_slots_used,
        block_time_id,
        inviting_parent_id,
        existing_block_id
    ) VALUES (
        v_group_id,
        p_inviting_parent_id,
        v_child_id,
        v_care_date,
        v_start_time,
        v_end_time,
        v_duration_minutes,
        p_notes,
        'open_block',
        'pending',
        p_inviting_parent_id,
        array_length(p_invited_parent_ids, 1),
        0,
        v_block_time_id,
        p_inviting_parent_id,
        p_existing_block_id
    ) RETURNING id INTO v_care_request_id;
    
    -- Create care responses for each invited parent
    FOR i IN 1..array_length(p_invited_parent_ids, 1)
    LOOP
        v_invited_parent_id := p_invited_parent_ids[i];
        v_reciprocal_date := p_reciprocal_dates[i];
        v_reciprocal_start_time := p_reciprocal_start_times[i];
        v_reciprocal_end_time := p_reciprocal_end_times[i];
        
        -- Get the child ID for this invited parent (you might need to adjust this logic)
        SELECT child_id INTO v_reciprocal_child_id
        FROM children 
        WHERE parent_id = v_invited_parent_id 
        LIMIT 1;
        
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
            'open_block_invitation',
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
