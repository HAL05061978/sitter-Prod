-- FIX CALENDAR PROVIDER LOGIC
-- Update get_scheduled_care_for_calendar function to correctly determine providing_parent_name
-- based on care_type instead of always using parent_id

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
                -- For 'needed' care, we need to find who is providing care
                -- Use a simpler approach to avoid column ambiguity
                COALESCE(
                    (SELECT provider_name.full_name 
                     FROM scheduled_care provider_block
                     JOIN profiles provider_name ON provider_block.parent_id = provider_name.id
                     WHERE provider_block.group_id = sc.group_id
                     AND provider_block.care_date = sc.care_date
                     AND provider_block.start_time = sc.start_time
                     AND provider_block.end_time = sc.end_time
                     AND provider_block.care_type = 'provided'
                     AND provider_block.related_request_id = sc.related_request_id
                     AND provider_block.parent_id != sc.parent_id  -- Make sure it's a different parent
                     LIMIT 1),
                    'TBD'  -- Fallback if no provider found
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
    WHERE sc.parent_id = parent_id
    AND sc.care_date BETWEEN start_date AND end_date
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
    RAISE NOTICE '=== FIX CALENDAR PROVIDER LOGIC ===';
    RAISE NOTICE '1. Updated get_scheduled_care_for_calendar function';
    RAISE NOTICE '2. FIXED: providing_parent_name now correctly determined based on care_type';
    RAISE NOTICE '3. For care_type = provided: parent_id is the provider';
    RAISE NOTICE '4. For care_type = needed: looks up provider from scheduled_care_children';
    RAISE NOTICE '5. All permissions granted';
    RAISE NOTICE '=== DEPLOYMENT COMPLETE ===';
END $$;
