-- =====================================================
-- FIX HANGOUT/SLEEPOVER UI DISPLAY
-- =====================================================
-- This migration fixes two issues:
-- 1. Calendar blocks not showing provider and children correctly
-- 2. Invitations not appearing in scheduler/messages page

-- =====================================================
-- PART 1: Update get_scheduled_care_for_calendar
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
            WHEN sc.care_type IN ('hangout', 'sleepover', 'event', 'open_block') THEN
                -- For hangout/sleepover/event/open_block, the parent_id is the host/organizer
                p.full_name
            ELSE
                'Unknown'
        END as providing_parent_name,
        -- Show ALL children involved in this care block from scheduled_care_children
        ARRAY_AGG(DISTINCT c.full_name ORDER BY c.full_name) as children_names
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

-- =====================================================
-- PART 2: Create get_hangout_sleepover_invitations
-- =====================================================

CREATE OR REPLACE FUNCTION get_hangout_sleepover_invitations(p_parent_id UUID)
RETURNS TABLE (
    care_response_id UUID,
    care_request_id UUID,
    group_id UUID,
    group_name TEXT,
    host_parent_id UUID,
    host_parent_name TEXT,
    requested_date DATE,
    start_time TIME,
    end_time TIME,
    end_date DATE,
    request_type TEXT,
    invited_child_id UUID,
    invited_child_name TEXT,
    hosting_children_names TEXT[],
    response_type TEXT,
    status TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT
        cr.id as care_response_id,
        cr.request_id as care_request_id,
        cq.group_id,
        g.name as group_name,
        cq.requester_id as host_parent_id,
        host_profile.full_name as host_parent_name,
        cq.requested_date,
        cq.start_time,
        cq.end_time,
        cq.end_date,
        cq.request_type,
        cr.invited_child_id,
        invited_child.full_name as invited_child_name,
        -- Get all hosting children names
        COALESCE(
            ARRAY(
                SELECT c.full_name
                FROM scheduled_care sc
                JOIN scheduled_care_children scc ON sc.id = scc.scheduled_care_id
                JOIN children c ON scc.child_id = c.id
                WHERE sc.related_request_id = cq.id
                AND sc.parent_id = cq.requester_id
                ORDER BY c.full_name
            ),
            ARRAY[]::TEXT[]
        ) as hosting_children_names,
        cr.response_type,
        cr.status,
        cq.notes,
        cr.created_at
    FROM care_responses cr
    JOIN care_requests cq ON cr.request_id = cq.id
    JOIN groups g ON cq.group_id = g.id
    JOIN profiles host_profile ON cq.requester_id = host_profile.id
    LEFT JOIN children invited_child ON cr.invited_child_id = invited_child.id
    WHERE cr.responder_id = p_parent_id
    AND cr.response_type = 'pending'
    AND cr.status = 'pending'
    AND cq.request_type IN ('hangout', 'sleepover')
    AND cq.action_type IN ('hangout_invitation', 'sleepover_invitation')
    ORDER BY cr.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION get_hangout_sleepover_invitations(UUID) TO authenticated;

COMMENT ON FUNCTION get_scheduled_care_for_calendar IS 'Returns scheduled care blocks for calendar display. Updated to handle hangout, sleepover, event, and open_block care types.';
COMMENT ON FUNCTION get_hangout_sleepover_invitations IS 'Returns pending hangout and sleepover invitations for a parent, showing hosting children and invited child details.';
