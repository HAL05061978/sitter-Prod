-- FIX PROVIDER LOGIC
-- Fix the provider logic to show actual provider for "receiving care" blocks

DROP FUNCTION IF EXISTS get_scheduled_care_for_calendar(UUID, DATE, DATE);

CREATE OR REPLACE FUNCTION get_scheduled_care_for_calendar(
    parent_id UUID,
    start_date DATE,
    end_date DATE
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
        -- FIXED: Correctly determine providing_parent_name based on care_type
        CASE 
            WHEN sc.care_type = 'provided' THEN 
                -- For 'provided' care, the parent_id is the provider
                p.full_name
            WHEN sc.care_type = 'needed' THEN
                -- For 'needed' care, find the corresponding provider
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
            ELSE 
                'Unknown'
        END as providing_parent_name,
        ARRAY_AGG(DISTINCT c.full_name) as children_names
    FROM scheduled_care sc
    JOIN groups g ON sc.group_id = g.id
    JOIN profiles p ON sc.parent_id = p.id
    LEFT JOIN scheduled_care_children scc ON sc.id = scc.scheduled_care_id
    LEFT JOIN children c ON scc.child_id = c.id
    WHERE sc.parent_id = get_scheduled_care_for_calendar.parent_id
    AND sc.care_date BETWEEN get_scheduled_care_for_calendar.start_date AND get_scheduled_care_for_calendar.end_date
    AND sc.status = 'confirmed'
    GROUP BY sc.id, g.name, sc.care_date, sc.start_time, sc.end_time, sc.care_type, sc.status, sc.notes, p.full_name
    ORDER BY sc.care_date, sc.start_time;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_scheduled_care_for_calendar(UUID, DATE, DATE) TO authenticated;

-- Test deployment
DO $$
BEGIN
    RAISE NOTICE '=== FIX PROVIDER LOGIC ===';
    RAISE NOTICE '1. Fixed provider logic in get_scheduled_care_for_calendar function';
    RAISE NOTICE '2. For care_type = provided: shows logged-in user as provider';
    RAISE NOTICE '3. For care_type = needed: shows actual provider from corresponding block';
    RAISE NOTICE '4. Uses related_request_id to match corresponding blocks';
    RAISE NOTICE '5. Ensures provider is different from the logged-in user';
    RAISE NOTICE '6. All permissions granted';
    RAISE NOTICE '=== FIX COMPLETE ===';
END $$;
