-- =====================================================
-- FIX HANGOUT/SLEEPOVER CARE_RESPONSES COLUMNS
-- =====================================================
-- Fix the column names for inserting into care_responses

-- =====================================================
-- Update create_hangout_invitation function
-- =====================================================

CREATE OR REPLACE FUNCTION create_hangout_invitation(
    p_requesting_parent_id UUID,
    p_group_id UUID,
    p_care_date DATE,
    p_start_time TIME,
    p_end_time TIME,
    p_hosting_child_ids UUID[],
    p_invited_child_ids UUID[],
    p_notes TEXT DEFAULT NULL
)
RETURNS TABLE(
    success BOOLEAN,
    message TEXT,
    request_id UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_request_id UUID;
    v_invited_child RECORD;
    v_invited_parent_id UUID;
    v_created_responses INTEGER := 0;
    v_host_block_id UUID;
BEGIN
    -- Validate inputs
    IF p_requesting_parent_id IS NULL THEN
        RETURN QUERY SELECT FALSE, 'Requesting parent ID is required'::TEXT, NULL::UUID;
        RETURN;
    END IF;

    IF p_group_id IS NULL THEN
        RETURN QUERY SELECT FALSE, 'Group ID is required'::TEXT, NULL::UUID;
        RETURN;
    END IF;

    IF p_care_date IS NULL OR p_start_time IS NULL OR p_end_time IS NULL THEN
        RETURN QUERY SELECT FALSE, 'Date and times are required'::TEXT, NULL::UUID;
        RETURN;
    END IF;

    IF array_length(p_hosting_child_ids, 1) IS NULL OR array_length(p_hosting_child_ids, 1) = 0 THEN
        RETURN QUERY SELECT FALSE, 'At least one hosting child must be selected'::TEXT, NULL::UUID;
        RETURN;
    END IF;

    IF array_length(p_invited_child_ids, 1) IS NULL OR array_length(p_invited_child_ids, 1) = 0 THEN
        RETURN QUERY SELECT FALSE, 'At least one child must be invited'::TEXT, NULL::UUID;
        RETURN;
    END IF;

    -- Create the care request with child_id = NULL
    INSERT INTO care_requests (
        group_id,
        requester_id,
        child_id,
        requested_date,
        start_time,
        end_time,
        end_date,
        request_type,
        action_type,
        status,
        notes
    )
    VALUES (
        p_group_id,
        p_requesting_parent_id,
        NULL,  -- No single child for hangouts
        p_care_date,
        p_start_time,
        p_end_time,
        NULL,  -- Hangouts don't have end_date
        'hangout',
        'hangout_invitation',
        'pending',
        p_notes
    )
    RETURNING id INTO v_request_id;

    -- Create scheduled_care block for the host with child_id = NULL
    INSERT INTO scheduled_care (
        parent_id,
        group_id,
        child_id,
        care_date,
        start_time,
        end_time,
        end_date,
        care_type,
        status,
        notes,
        related_request_id
    )
    VALUES (
        p_requesting_parent_id,
        p_group_id,
        NULL,  -- No single child - tracked in scheduled_care_children
        p_care_date,
        p_start_time,
        p_end_time,
        NULL,  -- Hangouts don't have end_date
        'hangout',
        'confirmed',
        p_notes,
        v_request_id
    )
    RETURNING id INTO v_host_block_id;

    -- Add hosting children to scheduled_care_children with providing_parent_id
    INSERT INTO scheduled_care_children (scheduled_care_id, child_id, providing_parent_id)
    SELECT v_host_block_id, unnest(p_hosting_child_ids), p_requesting_parent_id;

    -- Create care_responses for each invited child's parent
    FOR v_invited_child IN
        SELECT DISTINCT c.id as child_id, c.parent_id
        FROM children c
        WHERE c.id = ANY(p_invited_child_ids)
    LOOP
        v_invited_parent_id := v_invited_child.parent_id;

        -- Create response record with correct column names
        INSERT INTO care_responses (
            request_id,
            responder_id,
            invited_child_id,
            response_type,
            status
        )
        VALUES (
            v_request_id,
            v_invited_parent_id,
            v_invited_child.child_id,
            'pending',
            'pending'
        );

        v_created_responses := v_created_responses + 1;
    END LOOP;

    -- Return success
    RETURN QUERY SELECT
        TRUE,
        format('Hangout invitation created with %s invitations sent', v_created_responses)::TEXT,
        v_request_id;
END;
$$;

-- =====================================================
-- Update create_sleepover_invitation function
-- =====================================================

CREATE OR REPLACE FUNCTION create_sleepover_invitation(
    p_requesting_parent_id UUID,
    p_group_id UUID,
    p_care_date DATE,
    p_start_time TIME,
    p_end_date DATE,
    p_end_time TIME,
    p_hosting_child_ids UUID[],
    p_invited_child_ids UUID[],
    p_notes TEXT DEFAULT NULL
)
RETURNS TABLE(
    success BOOLEAN,
    message TEXT,
    request_id UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_request_id UUID;
    v_invited_child RECORD;
    v_invited_parent_id UUID;
    v_created_responses INTEGER := 0;
    v_host_block_id UUID;
BEGIN
    -- Validate inputs
    IF p_requesting_parent_id IS NULL THEN
        RETURN QUERY SELECT FALSE, 'Requesting parent ID is required'::TEXT, NULL::UUID;
        RETURN;
    END IF;

    IF p_group_id IS NULL THEN
        RETURN QUERY SELECT FALSE, 'Group ID is required'::TEXT, NULL::UUID;
        RETURN;
    END IF;

    IF p_care_date IS NULL OR p_start_time IS NULL OR p_end_date IS NULL OR p_end_time IS NULL THEN
        RETURN QUERY SELECT FALSE, 'Start date, end date, and times are required'::TEXT, NULL::UUID;
        RETURN;
    END IF;

    IF p_end_date <= p_care_date THEN
        RETURN QUERY SELECT FALSE, 'End date must be after start date for sleepovers'::TEXT, NULL::UUID;
        RETURN;
    END IF;

    IF array_length(p_hosting_child_ids, 1) IS NULL OR array_length(p_hosting_child_ids, 1) = 0 THEN
        RETURN QUERY SELECT FALSE, 'At least one hosting child must be selected'::TEXT, NULL::UUID;
        RETURN;
    END IF;

    IF array_length(p_invited_child_ids, 1) IS NULL OR array_length(p_invited_child_ids, 1) = 0 THEN
        RETURN QUERY SELECT FALSE, 'At least one child must be invited'::TEXT, NULL::UUID;
        RETURN;
    END IF;

    -- Create the care request with child_id = NULL
    INSERT INTO care_requests (
        group_id,
        requester_id,
        child_id,
        requested_date,
        start_time,
        end_time,
        end_date,
        request_type,
        action_type,
        status,
        notes
    )
    VALUES (
        p_group_id,
        p_requesting_parent_id,
        NULL,  -- No single child for sleepovers
        p_care_date,
        p_start_time,
        p_end_time,
        p_end_date,  -- Sleepovers have end_date
        'sleepover',
        'sleepover_invitation',
        'pending',
        p_notes
    )
    RETURNING id INTO v_request_id;

    -- Create scheduled_care block for the host with child_id = NULL
    INSERT INTO scheduled_care (
        parent_id,
        group_id,
        child_id,
        care_date,
        start_time,
        end_time,
        end_date,
        care_type,
        status,
        notes,
        related_request_id
    )
    VALUES (
        p_requesting_parent_id,
        p_group_id,
        NULL,  -- No single child - tracked in scheduled_care_children
        p_care_date,
        p_start_time,
        p_end_time,
        p_end_date,  -- Sleepovers have end_date
        'sleepover',
        'confirmed',
        p_notes,
        v_request_id
    )
    RETURNING id INTO v_host_block_id;

    -- Add hosting children to scheduled_care_children with providing_parent_id
    INSERT INTO scheduled_care_children (scheduled_care_id, child_id, providing_parent_id)
    SELECT v_host_block_id, unnest(p_hosting_child_ids), p_requesting_parent_id;

    -- Create care_responses for each invited child's parent
    FOR v_invited_child IN
        SELECT DISTINCT c.id as child_id, c.parent_id
        FROM children c
        WHERE c.id = ANY(p_invited_child_ids)
    LOOP
        v_invited_parent_id := v_invited_child.parent_id;

        -- Create response record with correct column names
        INSERT INTO care_responses (
            request_id,
            responder_id,
            invited_child_id,
            response_type,
            status
        )
        VALUES (
            v_request_id,
            v_invited_parent_id,
            v_invited_child.child_id,
            'pending',
            'pending'
        );

        v_created_responses := v_created_responses + 1;
    END LOOP;

    -- Return success
    RETURN QUERY SELECT
        TRUE,
        format('Sleepover invitation created with %s invitations sent', v_created_responses)::TEXT,
        v_request_id;
END;
$$;

COMMENT ON FUNCTION create_hangout_invitation IS 'Creates a hangout invitation with multiple hosting and invited children. Uses correct care_responses column names: request_id, responder_id, response_type, status.';
COMMENT ON FUNCTION create_sleepover_invitation IS 'Creates a sleepover invitation with multiple hosting and invited children. Uses correct care_responses column names: request_id, responder_id, response_type, status.';
