-- =====================================================
-- FIX HANGOUT CHILDREN AND DISPLAY
-- =====================================================
-- 1. Fix accept function to add all children to both blocks
-- 2. Fix calendar function to show correct provider and distinguish hosting vs attending

-- =====================================================
-- PART 1: Fix accept function to add children to both blocks
-- =====================================================

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
        'Attending ' || v_request_type || ' hosted by host - ' || COALESCE(v_notes, ''),
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

-- =====================================================
-- PART 2: Fix calendar display
-- =====================================================

DROP FUNCTION IF EXISTS get_scheduled_care_for_calendar(UUID, DATE, DATE);

CREATE OR REPLACE FUNCTION get_scheduled_care_for_calendar(
    p_parent_id UUID,
    p_start_date DATE,
    p_end_date DATE
)
RETURNS TABLE (
    id UUID,
    group_name TEXT,
    care_date DATE,
    start_time TIME,
    end_time TIME,
    care_type TEXT,
    status TEXT,
    notes TEXT,
    children_count BIGINT,
    providing_parent_name TEXT,
    children_names TEXT[]
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT
        sc.id,
        g.name as group_name,
        sc.care_date,
        sc.start_time,
        sc.end_time,
        sc.care_type,
        sc.status,
        sc.notes,
        COUNT(DISTINCT scc.child_id) as children_count,
        -- Handle all care types including hangout/sleepover
        CASE
            WHEN sc.care_type = 'needed' THEN
                -- For 'needed' care, find the corresponding provider from related blocks
                COALESCE(
                    (SELECT provider_profile.full_name
                     FROM scheduled_care provider_care
                     JOIN profiles provider_profile ON provider_care.parent_id = provider_profile.id
                     WHERE provider_care.group_id = sc.group_id
                     AND provider_care.care_date = sc.care_date
                     AND provider_care.start_time = sc.start_time
                     AND provider_care.end_time = sc.end_time
                     AND provider_care.care_type = 'provided'
                     AND provider_care.related_request_id = sc.related_request_id
                     AND provider_care.parent_id != sc.parent_id
                     LIMIT 1),
                    'TBD'
                )
            WHEN sc.care_type = 'provided' THEN
                -- For 'provided' care, the parent_id is the provider
                p.full_name
            WHEN sc.care_type IN ('hangout', 'sleepover') THEN
                -- For hangout/sleepover, get the provider from scheduled_care_children
                -- The providing_parent_id is the host
                COALESCE(
                    (SELECT DISTINCT host_profile.full_name
                     FROM scheduled_care_children scc_provider
                     JOIN profiles host_profile ON scc_provider.providing_parent_id = host_profile.id
                     WHERE scc_provider.scheduled_care_id = sc.id
                     LIMIT 1),
                    p.full_name  -- Fallback to parent if no provider found (they are the host)
                )
            WHEN sc.care_type IN ('event', 'open_block') THEN
                -- For event/open_block, the parent_id is the host/organizer
                p.full_name
            ELSE
                'Unknown'
        END as providing_parent_name,
        -- Show ALL children involved in this care block from scheduled_care_children
        ARRAY_AGG(DISTINCT c.full_name ORDER BY c.full_name) FILTER (WHERE c.full_name IS NOT NULL) as children_names
    FROM scheduled_care sc
    JOIN groups g ON sc.group_id = g.id
    JOIN profiles p ON sc.parent_id = p.id
    -- Join with scheduled_care_children to get ALL children involved
    LEFT JOIN scheduled_care_children scc ON sc.id = scc.scheduled_care_id
    LEFT JOIN children c ON scc.child_id = c.id
    WHERE sc.parent_id = p_parent_id
    AND sc.care_date BETWEEN p_start_date AND p_end_date
    AND sc.status = 'confirmed'
    GROUP BY sc.id, g.name, sc.care_date, sc.start_time, sc.end_time, sc.care_type, sc.status, sc.notes, p.full_name
    ORDER BY sc.care_date, sc.start_time;
END;
$$;

GRANT EXECUTE ON FUNCTION get_scheduled_care_for_calendar(UUID, DATE, DATE) TO authenticated;

COMMENT ON FUNCTION accept_hangout_sleepover_invitation IS 'Accepts a hangout/sleepover invitation. Adds accepting child to both blocks (host and attending), and adds hosting children to attending block so both parties see all children involved.';
COMMENT ON FUNCTION get_scheduled_care_for_calendar IS 'Returns scheduled care blocks for calendar. For hangout/sleepover, gets provider from scheduled_care_children.providing_parent_id to show the actual host.';
