-- =====================================================
-- FIX HANGOUT/SLEEPOVER ACCEPT - STATUS UPDATE
-- =====================================================
-- Fix the accept function to only update status, not response_type

DROP FUNCTION IF EXISTS accept_hangout_sleepover_invitation(UUID, UUID, UUID);
DROP FUNCTION IF EXISTS decline_hangout_sleepover_invitation(UUID, UUID, TEXT);

CREATE OR REPLACE FUNCTION accept_hangout_sleepover_invitation(
    p_care_response_id UUID,
    p_accepting_parent_id UUID,
    p_invited_child_id UUID
)
RETURNS TABLE(
    success BOOLEAN,
    message TEXT,
    scheduled_care_id UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_care_request_id UUID;
    v_group_id UUID;
    v_care_date DATE;
    v_start_time TIME;
    v_end_time TIME;
    v_end_date DATE;
    v_request_type TEXT;
    v_host_parent_id UUID;
    v_new_scheduled_care_id UUID;
    v_notes TEXT;
BEGIN
    -- Validate that the response belongs to this parent
    IF NOT EXISTS (
        SELECT 1 FROM care_responses
        WHERE id = p_care_response_id
        AND responder_id = p_accepting_parent_id
    ) THEN
        RETURN QUERY SELECT FALSE, 'Invalid invitation or not authorized'::TEXT, NULL::UUID;
        RETURN;
    END IF;

    -- Get the invitation details
    SELECT
        cr.request_id,
        cq.group_id,
        cq.requested_date,
        cq.start_time,
        cq.end_time,
        cq.end_date,
        cq.request_type,
        cq.requester_id,
        cq.notes
    INTO
        v_care_request_id,
        v_group_id,
        v_care_date,
        v_start_time,
        v_end_time,
        v_end_date,
        v_request_type,
        v_host_parent_id,
        v_notes
    FROM care_responses cr
    JOIN care_requests cq ON cr.request_id = cq.id
    WHERE cr.id = p_care_response_id;

    -- Check if already accepted
    IF EXISTS (
        SELECT 1 FROM care_responses
        WHERE id = p_care_response_id
        AND status != 'pending'
    ) THEN
        RETURN QUERY SELECT FALSE, 'Invitation already responded to'::TEXT, NULL::UUID;
        RETURN;
    END IF;

    -- Create scheduled_care block for the accepting parent (receiving care)
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
        p_accepting_parent_id,
        v_group_id,
        NULL,  -- Multi-child - tracked in scheduled_care_children
        v_care_date,
        v_start_time,
        v_end_time,
        v_end_date,
        v_request_type,  -- 'hangout' or 'sleepover'
        'confirmed',
        'Attending ' || v_request_type || ' - ' || COALESCE(v_notes, ''),
        v_care_request_id
    )
    RETURNING id INTO v_new_scheduled_care_id;

    -- Add the invited child to scheduled_care_children
    INSERT INTO scheduled_care_children (
        scheduled_care_id,
        child_id,
        providing_parent_id  -- The host parent is still the provider
    )
    VALUES (
        v_new_scheduled_care_id,
        p_invited_child_id,
        v_host_parent_id
    );

    -- Update the care_response status (ONLY status, not response_type)
    UPDATE care_responses
    SET
        status = 'accepted',
        updated_at = NOW()
    WHERE id = p_care_response_id;

    -- Return success
    RETURN QUERY SELECT
        TRUE,
        format('Successfully accepted %s invitation', v_request_type)::TEXT,
        v_new_scheduled_care_id;
END;
$$;

CREATE OR REPLACE FUNCTION decline_hangout_sleepover_invitation(
    p_care_response_id UUID,
    p_declining_parent_id UUID,
    p_decline_reason TEXT DEFAULT NULL
)
RETURNS TABLE(
    success BOOLEAN,
    message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_request_type TEXT;
BEGIN
    -- Validate that the response belongs to this parent
    IF NOT EXISTS (
        SELECT 1 FROM care_responses
        WHERE id = p_care_response_id
        AND responder_id = p_declining_parent_id
    ) THEN
        RETURN QUERY SELECT FALSE, 'Invalid invitation or not authorized'::TEXT;
        RETURN;
    END IF;

    -- Get the request type
    SELECT cq.request_type INTO v_request_type
    FROM care_responses cr
    JOIN care_requests cq ON cr.request_id = cq.id
    WHERE cr.id = p_care_response_id;

    -- Check if already responded
    IF EXISTS (
        SELECT 1 FROM care_responses
        WHERE id = p_care_response_id
        AND status != 'pending'
    ) THEN
        RETURN QUERY SELECT FALSE, 'Invitation already responded to'::TEXT;
        RETURN;
    END IF;

    -- Update the care_response status (ONLY status, not response_type)
    UPDATE care_responses
    SET
        status = 'declined',
        response_notes = p_decline_reason,
        updated_at = NOW()
    WHERE id = p_care_response_id;

    -- Return success
    RETURN QUERY SELECT
        TRUE,
        format('Successfully declined %s invitation', v_request_type)::TEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION accept_hangout_sleepover_invitation(UUID, UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION decline_hangout_sleepover_invitation(UUID, UUID, TEXT) TO authenticated;

COMMENT ON FUNCTION accept_hangout_sleepover_invitation IS 'Accepts a hangout or sleepover invitation, creating a receiving care block for the invited child. Only updates status field, not response_type.';
COMMENT ON FUNCTION decline_hangout_sleepover_invitation IS 'Declines a hangout or sleepover invitation with optional reason. Only updates status field, not response_type.';
