-- =====================================================
-- ADD NOTIFICATION TO HANGOUT/SLEEPOVER ACCEPT
-- =====================================================
-- Add notification creation when accepting hangout/sleepover invitations
-- This enables the calendar counter to increment correctly

DROP FUNCTION IF EXISTS accept_hangout_sleepover_invitation(UUID, UUID, UUID);

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

    -- CRITICAL: Synchronize children across ALL related blocks
    -- Get ALL children from ALL existing blocks for this hangout (host + accepted attendees)
    -- and add them to the new accepting parent's block
    INSERT INTO scheduled_care_children (
        scheduled_care_id,
        child_id,
        providing_parent_id
    )
    SELECT DISTINCT
        v_new_scheduled_care_id,
        scc.child_id,
        scc.providing_parent_id
    FROM scheduled_care sc
    JOIN scheduled_care_children scc ON scc.scheduled_care_id = sc.id
    WHERE sc.related_request_id = v_care_request_id
    AND sc.care_type = v_request_type
    AND sc.status = 'confirmed'
    -- Avoid duplicates
    AND NOT EXISTS (
        SELECT 1 FROM scheduled_care_children existing
        WHERE existing.scheduled_care_id = v_new_scheduled_care_id
        AND existing.child_id = scc.child_id
    );

    -- Add the new accepting child to the new block
    INSERT INTO scheduled_care_children (
        scheduled_care_id,
        child_id,
        providing_parent_id
    )
    VALUES (
        v_new_scheduled_care_id,
        p_invited_child_id,
        v_host_parent_id
    )
    ON CONFLICT DO NOTHING;

    -- CRITICAL: Add the new accepting child to ALL existing blocks (host + other attendees)
    -- This ensures everyone sees the new child
    INSERT INTO scheduled_care_children (
        scheduled_care_id,
        child_id,
        providing_parent_id
    )
    SELECT
        sc.id,
        p_invited_child_id,
        v_host_parent_id
    FROM scheduled_care sc
    WHERE sc.related_request_id = v_care_request_id
    AND sc.care_type = v_request_type
    AND sc.status = 'confirmed'
    AND sc.id != v_new_scheduled_care_id  -- Don't add to the new block again
    -- Avoid duplicates
    AND NOT EXISTS (
        SELECT 1 FROM scheduled_care_children scc
        WHERE scc.scheduled_care_id = sc.id
        AND scc.child_id = p_invited_child_id
    );

    -- Update the care_response status (ONLY status, not response_type)
    UPDATE care_responses
    SET
        status = 'accepted',
        updated_at = NOW()
    WHERE id = p_care_response_id;

    -- =====================================================
    -- NEW: Send notifications to BOTH parents
    -- =====================================================

    -- 1. Notification to the accepting parent (enables calendar counter)
    INSERT INTO notifications (
        id,
        user_id,
        type,
        title,
        message,
        data,
        is_read,
        created_at
    )
    VALUES (
        gen_random_uuid(),
        p_accepting_parent_id,
        'care_accepted',
        format('%s Invitation Accepted', INITCAP(v_request_type)),
        format('Your %s invitation has been accepted and added to your calendar.', v_request_type),
        jsonb_build_object(
            'care_response_id', p_care_response_id,
            'care_request_id', v_care_request_id,
            'host_parent_id', v_host_parent_id,
            'care_date', v_care_date,
            'start_time', v_start_time,
            'end_time', v_end_time,
            'end_date', v_end_date,
            'care_type', v_request_type,
            'blocks_created', 1,  -- Only 1 block created for accepting parent
            'scheduled_care_id', v_new_scheduled_care_id
        ),
        false,
        NOW()
    );

    -- 2. Notification to the HOST parent (notifies them someone accepted)
    -- Get the accepting parent's name for the notification
    INSERT INTO notifications (
        id,
        user_id,
        type,
        title,
        message,
        data,
        is_read,
        created_at
    )
    SELECT
        gen_random_uuid(),
        v_host_parent_id,
        'hangout_accepted',
        format('%s has accepted your %s invitation for %s from %s to %s',
            p.full_name,
            v_request_type,
            TO_CHAR(v_care_date, 'Mon DD, YYYY'),
            TO_CHAR(v_start_time, 'HH12:MI AM'),
            TO_CHAR(v_end_time, 'HH12:MI AM')
        ),
        '',  -- Empty message field since title has everything
        jsonb_build_object(
            'care_response_id', p_care_response_id,
            'care_request_id', v_care_request_id,
            'accepting_parent_id', p_accepting_parent_id,
            'accepting_parent_name', p.full_name,
            'care_date', v_care_date,
            'start_time', v_start_time,
            'end_time', v_end_time,
            'end_date', v_end_date,
            'care_type', v_request_type,
            'accepting_child_id', p_invited_child_id
        ),
        false,
        NOW()
    FROM profiles p
    WHERE p.id = p_accepting_parent_id;

    -- Return success
    RETURN QUERY SELECT
        TRUE,
        format('Successfully accepted %s invitation', v_request_type)::TEXT,
        v_new_scheduled_care_id;
END;
$$;

GRANT EXECUTE ON FUNCTION accept_hangout_sleepover_invitation(UUID, UUID, UUID) TO authenticated;

COMMENT ON FUNCTION accept_hangout_sleepover_invitation IS 'Accepts a hangout or sleepover invitation, creating a receiving care block and notification for the invited parent.';
