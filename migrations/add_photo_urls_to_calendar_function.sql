-- =====================================================
-- ADD PHOTO_URLS TO CALENDAR FUNCTIONS
-- =====================================================
-- Update calendar functions to include photo_urls field

-- Update get_scheduled_care_for_calendar function
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
    is_host BOOLEAN,
    photo_urls TEXT[]
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
        ARRAY_AGG(DISTINCT c.full_name ORDER BY c.full_name) FILTER (WHERE c.full_name IS NOT NULL) as children_names,
        -- Determine if this parent is the host
        CASE
            WHEN sc.care_type IN ('hangout', 'sleepover') THEN
                -- For hangout/sleepover, check if parent_id matches the requester_id
                COALESCE(
                    (SELECT sc.parent_id = cr.requester_id
                     FROM care_requests cr
                     WHERE cr.id = sc.related_request_id),
                    FALSE
                )
            WHEN sc.care_type = 'provided' THEN
                TRUE  -- Providing care means hosting
            WHEN sc.care_type = 'needed' THEN
                FALSE  -- Needed care means not hosting
            WHEN sc.care_type IN ('event', 'open_block') THEN
                TRUE  -- Events and open blocks are always hosted by the parent
            ELSE
                FALSE
        END as is_host,
        -- Include photo URLs - for 'needed' care and hangout/sleepover attendees, get photos from host/provider
        CASE
            WHEN sc.care_type = 'needed' THEN
                -- For receiving care, get photos from the matching providing block
                COALESCE(
                    (SELECT provider_care.photo_urls
                     FROM scheduled_care provider_care
                     WHERE provider_care.group_id = sc.group_id
                     AND provider_care.care_date = sc.care_date
                     AND provider_care.start_time = sc.start_time
                     AND provider_care.end_time = sc.end_time
                     AND provider_care.care_type = 'provided'
                     AND provider_care.related_request_id = sc.related_request_id
                     AND provider_care.parent_id != sc.parent_id
                     LIMIT 1),
                    sc.photo_urls
                )
            WHEN sc.care_type IN ('hangout', 'sleepover') THEN
                -- For hangout/sleepover attendees, get photos from the host's block
                COALESCE(
                    (SELECT host_care.photo_urls
                     FROM scheduled_care host_care
                     JOIN care_requests cr ON host_care.related_request_id = cr.id
                     WHERE host_care.group_id = sc.group_id
                     AND host_care.care_date = sc.care_date
                     AND host_care.start_time = sc.start_time
                     AND host_care.end_time = sc.end_time
                     AND host_care.care_type = sc.care_type
                     AND host_care.related_request_id = sc.related_request_id
                     AND host_care.parent_id = cr.requester_id
                     LIMIT 1),
                    sc.photo_urls  -- Fallback to own photos if host (or no host found)
                )
            ELSE
                sc.photo_urls
        END as photo_urls
    FROM scheduled_care sc
    JOIN groups g ON sc.group_id = g.id
    JOIN profiles p ON sc.parent_id = p.id
    -- Join with scheduled_care_children to get ALL children involved
    LEFT JOIN scheduled_care_children scc ON sc.id = scc.scheduled_care_id
    LEFT JOIN children c ON scc.child_id = c.id
    WHERE sc.parent_id = p_parent_id
    AND sc.care_date BETWEEN p_start_date AND p_end_date
    AND sc.status = 'confirmed'
    GROUP BY sc.id, g.name, sc.care_date, sc.start_time, sc.end_time, sc.care_type, sc.status, sc.notes, p.full_name, sc.photo_urls
    ORDER BY sc.care_date, sc.start_time;
END;
$$;

GRANT EXECUTE ON FUNCTION get_scheduled_care_for_calendar(UUID, DATE, DATE) TO authenticated;

COMMENT ON FUNCTION get_scheduled_care_for_calendar IS 'Returns scheduled care blocks for calendar with is_host field and photo_urls for sharing photos.';

-- Update get_scheduled_pet_care_for_calendar function
DROP FUNCTION IF EXISTS get_scheduled_pet_care_for_calendar(UUID, DATE, DATE);

CREATE OR REPLACE FUNCTION get_scheduled_pet_care_for_calendar(
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
    is_host BOOLEAN,
    photo_urls TEXT[]
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
        COUNT(DISTINCT scp.pet_id) as children_count,
        CASE
            WHEN sc.care_type = 'needed' THEN
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
                p.full_name
            WHEN sc.care_type IN ('event', 'open_block') THEN
                p.full_name
            ELSE
                'Unknown'
        END as providing_parent_name,
        ARRAY_AGG(DISTINCT pt.name ORDER BY pt.name) FILTER (WHERE pt.name IS NOT NULL) as children_names,
        CASE
            WHEN sc.care_type = 'provided' THEN TRUE
            WHEN sc.care_type = 'needed' THEN FALSE
            WHEN sc.care_type IN ('event', 'open_block') THEN TRUE
            ELSE FALSE
        END as is_host,
        -- Include photo URLs - for 'needed' care, get photos from the matching 'provided' block (pets don't have hangouts)
        CASE
            WHEN sc.care_type = 'needed' THEN
                -- For receiving care, get photos from the matching providing block
                COALESCE(
                    (SELECT provider_care.photo_urls
                     FROM scheduled_care provider_care
                     WHERE provider_care.group_id = sc.group_id
                     AND provider_care.care_date = sc.care_date
                     AND provider_care.start_time = sc.start_time
                     AND provider_care.end_time = sc.end_time
                     AND provider_care.care_type = 'provided'
                     AND provider_care.related_request_id = sc.related_request_id
                     AND provider_care.parent_id != sc.parent_id
                     LIMIT 1),
                    sc.photo_urls
                )
            ELSE
                sc.photo_urls
        END as photo_urls
    FROM scheduled_care sc
    JOIN groups g ON sc.group_id = g.id
    JOIN profiles p ON sc.parent_id = p.id
    LEFT JOIN scheduled_care_pets scp ON sc.id = scp.scheduled_care_id
    LEFT JOIN pets pt ON scp.pet_id = pt.id
    WHERE sc.parent_id = p_parent_id
    AND sc.care_date BETWEEN p_start_date AND p_end_date
    AND sc.status = 'confirmed'
    GROUP BY sc.id, g.name, sc.care_date, sc.start_time, sc.end_time, sc.care_type, sc.status, sc.notes, p.full_name, sc.photo_urls
    ORDER BY sc.care_date, sc.start_time;
END;
$$;

GRANT EXECUTE ON FUNCTION get_scheduled_pet_care_for_calendar(UUID, DATE, DATE) TO authenticated;

COMMENT ON FUNCTION get_scheduled_pet_care_for_calendar IS 'Returns scheduled pet care blocks for calendar with photo_urls for sharing photos.';
