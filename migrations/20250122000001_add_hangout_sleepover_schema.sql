-- =====================================================
-- ADD HANGOUT AND SLEEPOVER SUPPORT
-- =====================================================
-- This migration adds support for Hangout and Sleepover care types
-- These are non-reciprocal invitation-based events

-- =====================================================
-- STEP 1: Add end_date field to care_requests
-- =====================================================

-- Add end_date column to care_requests (for sleepovers that go overnight)
ALTER TABLE care_requests
ADD COLUMN IF NOT EXISTS end_date DATE;

COMMENT ON COLUMN care_requests.end_date IS 'End date for multi-day care (e.g., sleepovers). If NULL, end_time is on the same day as requested_date.';

-- =====================================================
-- STEP 2: Add end_date field to scheduled_care
-- =====================================================

-- Add end_date column to scheduled_care
ALTER TABLE scheduled_care
ADD COLUMN IF NOT EXISTS end_date DATE;

COMMENT ON COLUMN scheduled_care.end_date IS 'End date for multi-day care (e.g., sleepovers). If NULL, end_time is on the same day as care_date.';

-- =====================================================
-- STEP 3: Add invited_child_id to care_responses
-- =====================================================

-- Add column to track which specific child was invited (for hangouts/sleepovers)
ALTER TABLE care_responses
ADD COLUMN IF NOT EXISTS invited_child_id UUID REFERENCES children(id);

COMMENT ON COLUMN care_responses.invited_child_id IS 'The specific child that was invited (for hangout/sleepover invitations where multiple children from one family may be invited separately).';

-- =====================================================
-- STEP 4: Create function to create hangout invitation
-- =====================================================

CREATE OR REPLACE FUNCTION create_hangout_invitation(
    p_requesting_parent_id UUID,
    p_group_id UUID,
    p_care_date DATE,
    p_start_time TIME,
    p_end_time TIME,
    p_hosting_child_ids UUID[],  -- Array of host's children IDs
    p_invited_child_ids UUID[],  -- Array of invited children IDs from group
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

    -- Create the care request
    INSERT INTO care_requests (
        group_id,
        requester_id,
        requested_date,
        start_time,
        end_time,
        end_date,  -- NULL for hangouts (same day)
        request_type,
        action_type,
        status,
        notes
    )
    VALUES (
        p_group_id,
        p_requesting_parent_id,
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

    -- Create scheduled_care block for the host
    INSERT INTO scheduled_care (
        parent_id,
        group_id,
        care_date,
        start_time,
        end_time,
        end_date,  -- NULL for hangouts
        care_type,
        providing_care,
        status,
        notes,
        original_request_id
    )
    VALUES (
        p_requesting_parent_id,
        p_group_id,
        p_care_date,
        p_start_time,
        p_end_time,
        NULL,  -- Hangouts don't have end_date
        'hangout',
        TRUE,  -- Host is providing
        'confirmed',
        p_notes,
        v_request_id
    )
    RETURNING id INTO v_host_block_id;

    -- Add hosting children to scheduled_care_children
    INSERT INTO scheduled_care_children (scheduled_care_id, child_id)
    SELECT v_host_block_id, unnest(p_hosting_child_ids);

    -- Create care_responses for each invited child's parent
    FOR v_invited_child IN
        SELECT DISTINCT c.id as child_id, c.parent_id
        FROM children c
        WHERE c.id = ANY(p_invited_child_ids)
    LOOP
        v_invited_parent_id := v_invited_child.parent_id;

        -- Create response record
        INSERT INTO care_responses (
            care_request_id,
            responding_parent_id,
            invited_child_id,  -- Track which specific child was invited
            response_status,
            created_at
        )
        VALUES (
            v_request_id,
            v_invited_parent_id,
            v_invited_child.child_id,
            'pending',
            NOW()
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
-- STEP 5: Create function to create sleepover invitation
-- =====================================================

CREATE OR REPLACE FUNCTION create_sleepover_invitation(
    p_requesting_parent_id UUID,
    p_group_id UUID,
    p_care_date DATE,
    p_start_time TIME,
    p_end_date DATE,  -- Required for sleepovers
    p_end_time TIME,
    p_hosting_child_ids UUID[],  -- Array of host's children IDs
    p_invited_child_ids UUID[],  -- Array of invited children IDs from group
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

    -- Create the care request
    INSERT INTO care_requests (
        group_id,
        requester_id,
        requested_date,
        start_time,
        end_date,  -- Set for sleepovers
        end_time,
        request_type,
        action_type,
        status,
        notes
    )
    VALUES (
        p_group_id,
        p_requesting_parent_id,
        p_care_date,
        p_start_time,
        p_end_date,  -- Sleepovers have end_date
        p_end_time,
        'sleepover',
        'sleepover_invitation',
        'pending',
        p_notes
    )
    RETURNING id INTO v_request_id;

    -- Create scheduled_care block for the host
    INSERT INTO scheduled_care (
        parent_id,
        group_id,
        care_date,
        start_time,
        end_date,  -- Set for sleepovers
        end_time,
        care_type,
        providing_care,
        status,
        notes,
        original_request_id
    )
    VALUES (
        p_requesting_parent_id,
        p_group_id,
        p_care_date,
        p_start_time,
        p_end_date,  -- Sleepovers have end_date
        p_end_time,
        'sleepover',
        TRUE,  -- Host is providing
        'confirmed',
        p_notes,
        v_request_id
    )
    RETURNING id INTO v_host_block_id;

    -- Add hosting children to scheduled_care_children
    INSERT INTO scheduled_care_children (scheduled_care_id, child_id)
    SELECT v_host_block_id, unnest(p_hosting_child_ids);

    -- Create care_responses for each invited child's parent
    FOR v_invited_child IN
        SELECT DISTINCT c.id as child_id, c.parent_id
        FROM children c
        WHERE c.id = ANY(p_invited_child_ids)
    LOOP
        v_invited_parent_id := v_invited_child.parent_id;

        -- Create response record
        INSERT INTO care_responses (
            care_request_id,
            responding_parent_id,
            invited_child_id,  -- Track which specific child was invited
            response_status,
            created_at
        )
        VALUES (
            v_request_id,
            v_invited_parent_id,
            v_invited_child.child_id,
            'pending',
            NOW()
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

-- =====================================================
-- STEP 6: Grant permissions
-- =====================================================

GRANT EXECUTE ON FUNCTION create_hangout_invitation(UUID, UUID, DATE, TIME, TIME, UUID[], UUID[], TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION create_sleepover_invitation(UUID, UUID, DATE, TIME, DATE, TIME, UUID[], UUID[], TEXT) TO authenticated;

-- =====================================================
-- STEP 7: Add comments
-- =====================================================

COMMENT ON FUNCTION create_hangout_invitation IS 'Creates a hangout invitation with host block and invitation responses for selected children';
COMMENT ON FUNCTION create_sleepover_invitation IS 'Creates a sleepover invitation with host block and invitation responses for selected children';
