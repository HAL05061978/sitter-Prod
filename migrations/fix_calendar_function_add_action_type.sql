-- =====================================================
-- FIX CALENDAR FUNCTION - ADD ACTION_TYPE
-- =====================================================
-- This merges the working version (with action_type) and the new version (with photo_urls)
-- Critical fix: action_type was accidentally removed when adding photo support

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
    children_names TEXT[],
    action_type TEXT,
    is_host BOOLEAN,
    photo_urls TEXT[],
    group_id UUID,
    related_request_id UUID,
    children_data JSONB
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
        -- Handle all care types including hangout/sleepover and open blocks
        CASE
            WHEN sc.care_type = 'needed' THEN
                -- For 'needed' care, try multiple strategies to find the provider:
                -- 1. First, check scheduled_care_children.providing_parent_id (for open blocks)
                -- 2. If not found, look for matching provided block (for reciprocal care)
                COALESCE(
                    -- Strategy 1: Get provider from scheduled_care_children
                    (SELECT DISTINCT provider_profile.full_name
                     FROM scheduled_care_children scc_provider
                     JOIN profiles provider_profile ON scc_provider.providing_parent_id = provider_profile.id
                     WHERE scc_provider.scheduled_care_id = sc.id
                     AND scc_provider.providing_parent_id IS NOT NULL
                     LIMIT 1),
                    -- Strategy 2: Get provider from matching 'provided' block (fallback)
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
        ARRAY_AGG(DISTINCT c.full_name ORDER BY c.full_name) FILTER (WHERE c.full_name IS NOT NULL) as children_names,
        -- ✅ CRITICAL: Include action_type for rescheduled block display
        sc.action_type,
        -- Determine if this parent is the host for hangout/sleepover
        CASE
            WHEN sc.care_type IN ('hangout', 'sleepover') THEN
                -- If the parent_id matches the block owner, they are the host
                (sc.parent_id = p_parent_id AND
                 EXISTS (
                     SELECT 1 FROM scheduled_care_children scc_check
                     WHERE scc_check.scheduled_care_id = sc.id
                     AND scc_check.providing_parent_id = sc.parent_id
                 ))
            ELSE
                false
        END as is_host,
        -- Photo sharing logic
        CASE
            -- For 'needed' care, show photos from the corresponding 'provided' block
            WHEN sc.care_type = 'needed' THEN
                COALESCE(
                    (SELECT provider_care.photo_urls
                     FROM scheduled_care provider_care
                     WHERE provider_care.group_id = sc.group_id
                     AND provider_care.care_date = sc.care_date
                     AND provider_care.start_time = sc.start_time
                     AND provider_care.end_time = sc.end_time
                     AND provider_care.care_type = 'provided'
                     AND provider_care.related_request_id = sc.related_request_id
                     LIMIT 1),
                    sc.photo_urls
                )
            -- For hangout/sleepover attendees, show photos from host's block
            WHEN sc.care_type IN ('hangout', 'sleepover') AND NOT EXISTS (
                SELECT 1
                FROM scheduled_care_children scc_check
                WHERE scc_check.scheduled_care_id = sc.id
                AND scc_check.providing_parent_id = p_parent_id
            ) THEN
                COALESCE(
                    (SELECT host_care.photo_urls
                     FROM scheduled_care host_care
                     JOIN care_requests cr ON host_care.related_request_id = cr.id
                     WHERE host_care.group_id = sc.group_id
                     AND host_care.care_date = sc.care_date
                     AND host_care.start_time = sc.start_time
                     AND host_care.end_time = sc.end_time
                     AND host_care.care_type = sc.care_type
                     AND host_care.parent_id = cr.requester_id
                     LIMIT 1),
                    sc.photo_urls
                )
            ELSE
                sc.photo_urls
        END as photo_urls,
        sc.group_id,
        sc.related_request_id,
        -- Get children data as JSONB
        COALESCE(
            JSONB_AGG(
                DISTINCT JSONB_BUILD_OBJECT('id', c.id, 'full_name', c.full_name)
            ) FILTER (WHERE c.id IS NOT NULL),
            '[]'::JSONB
        ) as children_data
    FROM scheduled_care sc
    JOIN groups g ON sc.group_id = g.id
    JOIN profiles p ON sc.parent_id = p.id
    -- Join with scheduled_care_children to get ALL children involved
    LEFT JOIN scheduled_care_children scc ON sc.id = scc.scheduled_care_id
    LEFT JOIN children c ON scc.child_id = c.id
    WHERE sc.parent_id = p_parent_id
    AND sc.care_date BETWEEN p_start_date AND p_end_date
    AND sc.status IN ('confirmed', 'rescheduled')  -- ✅ Include both statuses
    GROUP BY sc.id, g.name, sc.care_date, sc.start_time, sc.end_time, sc.care_type, sc.status, sc.notes, sc.action_type, p.full_name, sc.photo_urls, sc.group_id, sc.related_request_id
    ORDER BY sc.care_date, sc.start_time;
END;
$$;

GRANT EXECUTE ON FUNCTION get_scheduled_care_for_calendar(UUID, DATE, DATE) TO authenticated;

COMMENT ON FUNCTION get_scheduled_care_for_calendar IS 'Returns scheduled care for calendar display including action_type for rescheduled blocks and photo_urls for photo sharing';
