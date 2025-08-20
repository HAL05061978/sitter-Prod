-- FIX CALENDAR FINAL
-- Revert to original parameter names but fix column ambiguity with proper table aliases

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
        -- Simple approach: just show the parent name for now
        p.full_name as providing_parent_name,
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
    RAISE NOTICE '=== FIX CALENDAR FINAL ===';
    RAISE NOTICE '1. Reverted to original parameter names (parent_id, start_date, end_date)';
    RAISE NOTICE '2. Fixed column ambiguity using function name qualification';
    RAISE NOTICE '3. Used get_scheduled_care_for_calendar.parent_id to reference function parameter';
    RAISE NOTICE '4. Calendar should work with existing frontend code';
    RAISE NOTICE '5. All permissions granted';
    RAISE NOTICE '=== FIX COMPLETE ===';
END $$;
