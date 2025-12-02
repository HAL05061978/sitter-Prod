-- =====================================================
-- ACCEPT/DECLINE FUNCTIONS FOR HANGOUT AND SLEEPOVER
-- =====================================================
-- These functions handle accepting and declining hangout/sleepover invitations
-- Unlike reciprocal care, these only create one block for the accepting parent

-- =====================================================
-- STEP 1: Create function to accept hangout/sleepover invitation
-- =====================================================

CREATE OR REPLACE FUNCTION accept_hangout_sleepover_invitation(
    p_care_response_id UUID
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
    v_response RECORD;
    v_request RECORD;
    v_scheduled_care_id UUID;
    v_action_type TEXT;
BEGIN
    -- Get the care response details
    SELECT cr.*
    INTO v_response
    FROM care_responses cr
    WHERE cr.id = p_care_response_id
    AND cr.response_status = 'pending';

    IF NOT FOUND THEN
        RETURN QUERY SELECT FALSE, 'Care response not found or already processed'::TEXT, NULL::UUID;
        RETURN;
    END IF;

    -- Get the care request details
    SELECT crq.*
    INTO v_request
    FROM care_requests crq
    WHERE crq.id = v_response.care_request_id;

    IF NOT FOUND THEN
        RETURN QUERY SELECT FALSE, 'Care request not found'::TEXT, NULL::UUID;
        RETURN;
    END IF;

    -- Verify this is a hangout or sleepover invitation
    IF v_request.action_type NOT IN ('hangout_invitation', 'sleepover_invitation') THEN
        RETURN QUERY SELECT FALSE, 'This function only handles hangout and sleepover invitations'::TEXT, NULL::UUID;
        RETURN;
    END IF;

    -- Update the care response to accepted
    UPDATE care_responses
    SET
        response_status = 'accepted',
        responded_at = NOW()
    WHERE id = p_care_response_id;

    -- Create scheduled care block for the accepting parent (attending the hangout/sleepover)
    INSERT INTO scheduled_care (
        parent_id,
        group_id,
        care_date,
        start_time,
        end_time,
        end_date,  -- Will be NULL for hangouts, set for sleepovers
        care_type,
        providing_care,  -- FALSE - they are attending, not hosting
        status,
        notes,
        original_request_id
    )
    VALUES (
        v_response.responding_parent_id,
        v_request.group_id,
        v_request.requested_date,
        v_request.start_time,
        v_request.end_time,
        v_request.end_date,
        v_request.request_type,
        FALSE,  -- Attending, not providing
        'confirmed',
        'Attending ' || v_request.request_type,
        v_request.id
    )
    RETURNING id INTO v_scheduled_care_id;

    -- Add the invited child to scheduled_care_children
    IF v_response.invited_child_id IS NOT NULL THEN
        INSERT INTO scheduled_care_children (
            scheduled_care_id,
            child_id
        )
        VALUES (
            v_scheduled_care_id,
            v_response.invited_child_id
        );
    END IF;

    -- Return success
    RETURN QUERY SELECT
        TRUE,
        'Successfully accepted ' || v_request.request_type || ' invitation'::TEXT,
        v_scheduled_care_id;

EXCEPTION
    WHEN OTHERS THEN
        RETURN QUERY SELECT FALSE, ('Error accepting invitation: ' || SQLERRM)::TEXT, NULL::UUID;
END;
$$;

-- =====================================================
-- STEP 2: Create function to decline hangout/sleepover invitation
-- =====================================================

CREATE OR REPLACE FUNCTION decline_hangout_sleepover_invitation(
    p_care_response_id UUID,
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
    v_response RECORD;
    v_request RECORD;
BEGIN
    -- Get the care response details
    SELECT cr.*
    INTO v_response
    FROM care_responses cr
    WHERE cr.id = p_care_response_id
    AND cr.response_status = 'pending';

    IF NOT FOUND THEN
        RETURN QUERY SELECT FALSE, 'Care response not found or already processed'::TEXT;
        RETURN;
    END IF;

    -- Get the care request details
    SELECT crq.*
    INTO v_request
    FROM care_requests crq
    WHERE crq.id = v_response.care_request_id;

    IF NOT FOUND THEN
        RETURN QUERY SELECT FALSE, 'Care request not found'::TEXT;
        RETURN;
    END IF;

    -- Verify this is a hangout or sleepover invitation
    IF v_request.action_type NOT IN ('hangout_invitation', 'sleepover_invitation') THEN
        RETURN QUERY SELECT FALSE, 'This function only handles hangout and sleepover invitations'::TEXT;
        RETURN;
    END IF;

    -- Update the care response to declined
    UPDATE care_responses
    SET
        response_status = 'declined',
        response_notes = p_decline_reason,
        responded_at = NOW()
    WHERE id = p_care_response_id;

    -- Return success
    RETURN QUERY SELECT
        TRUE,
        'Successfully declined ' || v_request.request_type || ' invitation'::TEXT;

EXCEPTION
    WHEN OTHERS THEN
        RETURN QUERY SELECT FALSE, ('Error declining invitation: ' || SQLERRM)::TEXT;
END;
$$;

-- =====================================================
-- STEP 3: Grant permissions
-- =====================================================

GRANT EXECUTE ON FUNCTION accept_hangout_sleepover_invitation(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION decline_hangout_sleepover_invitation(UUID, TEXT) TO authenticated;

-- =====================================================
-- STEP 4: Add comments
-- =====================================================

COMMENT ON FUNCTION accept_hangout_sleepover_invitation IS 'Accepts a hangout or sleepover invitation and creates attending block for the invited parent';
COMMENT ON FUNCTION decline_hangout_sleepover_invitation IS 'Declines a hangout or sleepover invitation';
