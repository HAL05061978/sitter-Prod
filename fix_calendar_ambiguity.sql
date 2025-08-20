-- FIX CALENDAR AMBIGUITY
-- Fix the column reference ambiguity by being explicit about all column references

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
        -- Simple approach: just show the parent name for now
        p.full_name as providing_parent_name,
        ARRAY_AGG(DISTINCT c.full_name) as children_names
    FROM scheduled_care sc
    JOIN groups g ON sc.group_id = g.id
    JOIN profiles p ON sc.parent_id = p.id
    LEFT JOIN scheduled_care_children scc ON sc.id = scc.scheduled_care_id
    LEFT JOIN children c ON scc.child_id = c.id
    WHERE sc.parent_id = p_parent_id
    AND sc.care_date BETWEEN p_start_date AND p_end_date
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
    RAISE NOTICE '=== FIX CALENDAR AMBIGUITY ===';
    RAISE NOTICE '1. Fixed column reference ambiguity in get_scheduled_care_for_calendar';
    RAISE NOTICE '2. Changed function parameters to p_parent_id, p_start_date, p_end_date';
    RAISE NOTICE '3. Updated WHERE clause to use sc.parent_id = p_parent_id';
    RAISE NOTICE '4. All column references now explicitly qualified';
    RAISE NOTICE '5. Calendar should work without column ambiguity errors';
    RAISE NOTICE '=== FIX COMPLETE ===';
END $$;
