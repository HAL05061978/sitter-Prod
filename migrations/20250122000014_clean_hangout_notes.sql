-- =====================================================
-- CLEAN HANGOUT NOTES - REMOVE PROGRAMMATIC TEXT
-- =====================================================
-- Update accept function to not include "Attending" in notes
-- since we now use is_host field for this logic

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
    v_host_block_id UUID;
    v_notes TEXT;
    v_hosting_child RECORD;
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

    -- Get the host's block ID
    SELECT id INTO v_host_block_id
    FROM scheduled_care
    WHERE parent_id = v_host_parent_id
    AND related_request_id = v_care_request_id
    AND care_type = v_request_type
    LIMIT 1;

    -- Create scheduled_care block for the accepting parent (attending)
    -- Notes field is now free for parents to use without programmatic text
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
        COALESCE(v_notes, ''),  -- Use original notes without adding "Attending" prefix
        v_care_request_id
    )
    RETURNING id INTO v_new_scheduled_care_id;

    -- Add the invited child to the ACCEPTING parent's block
    INSERT INTO scheduled_care_children (
        scheduled_care_id,
        child_id,
        providing_parent_id  -- The host parent is the provider
    )
    VALUES (
        v_new_scheduled_care_id,
        p_invited_child_id,
        v_host_parent_id
    );

    -- Add ALL hosting children to the ACCEPTING parent's block (so they see everyone attending)
    FOR v_hosting_child IN
        SELECT scc.child_id
        FROM scheduled_care_children scc
        WHERE scc.scheduled_care_id = v_host_block_id
    LOOP
        INSERT INTO scheduled_care_children (
            scheduled_care_id,
            child_id,
            providing_parent_id
        )
        VALUES (
            v_new_scheduled_care_id,
            v_hosting_child.child_id,
            v_host_parent_id
        );
    END LOOP;

    -- Add the invited child to the HOST's block (so host sees everyone attending)
    IF v_host_block_id IS NOT NULL THEN
        INSERT INTO scheduled_care_children (
            scheduled_care_id,
            child_id,
            providing_parent_id
        )
        VALUES (
            v_host_block_id,
            p_invited_child_id,
            v_host_parent_id
        );
    END IF;

    -- Update the care_response status
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

GRANT EXECUTE ON FUNCTION accept_hangout_sleepover_invitation(UUID, UUID, UUID) TO authenticated;

COMMENT ON FUNCTION accept_hangout_sleepover_invitation IS 'Accepts a hangout/sleepover invitation. Adds accepting child to both blocks (host and attending), and adds hosting children to attending block. Notes field is kept clean for parent use.';
