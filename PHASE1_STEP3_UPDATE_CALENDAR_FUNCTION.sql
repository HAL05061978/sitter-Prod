-- =====================================================
-- PHASE 1 STEP 3: Update get_scheduled_pet_care_for_calendar
-- =====================================================
-- Add end_date to return type and improve date range query
-- This allows multi-day blocks to be displayed correctly
--
-- SAFETY: This is safe because:
-- - Adding end_date field doesn't break existing calendar
-- - Frontend can ignore the field until Phase 2
-- - Improved WHERE clause handles both single and multi-day blocks
-- - NULL end_date = single day (backward compatible)
-- =====================================================

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
    end_date DATE,  -- NEW: Multi-day support
    start_time TIME,
    end_time TIME,
    care_type TEXT,
    status TEXT,
    notes TEXT,
    children_count BIGINT,
    providing_parent_name TEXT,
    children_names TEXT[],
    action_type TEXT,
    related_request_id UUID,
    group_id UUID,
    children_data JSONB,
    is_host BOOLEAN,
    pet_id UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT
        spc.id,
        g.name as group_name,
        spc.care_date,
        spc.end_date,  -- NEW: Return end_date for multi-day blocks
        spc.start_time,
        spc.end_time,
        spc.care_type::TEXT,
        spc.status::TEXT,
        spc.notes,
        COUNT(DISTINCT spcp.pet_id) as children_count,
        CASE
            WHEN spc.care_type = 'needed' THEN
                COALESCE(
                    (SELECT provider_profile.full_name
                     FROM scheduled_pet_care provider_care
                     JOIN profiles provider_profile ON provider_care.parent_id = provider_profile.id
                     WHERE provider_care.group_id = spc.group_id
                     AND provider_care.care_date = spc.care_date
                     AND provider_care.start_time = spc.start_time
                     AND provider_care.end_time = spc.end_time
                     AND provider_care.care_type = 'provided'
                     AND provider_care.related_request_id = spc.related_request_id
                     AND provider_care.parent_id != spc.parent_id
                     LIMIT 1),
                    'TBD'
                )
            WHEN spc.care_type = 'provided' THEN
                p.full_name
            ELSE
                'Unknown'
        END as providing_parent_name,
        ARRAY_AGG(DISTINCT pet.name::TEXT) as children_names,
        spc.action_type::TEXT,
        spc.related_request_id,
        spc.group_id,
        jsonb_agg(DISTINCT jsonb_build_object('id', pet.id, 'full_name', pet.name)) FILTER (WHERE pet.id IS NOT NULL) as children_data,
        FALSE as is_host,
        (ARRAY_AGG(DISTINCT spcp.pet_id))[1] as pet_id
    FROM scheduled_pet_care spc
    JOIN groups g ON spc.group_id = g.id
    JOIN profiles p ON spc.parent_id = p.id
    LEFT JOIN scheduled_pet_care_pets spcp ON spc.id = spcp.scheduled_pet_care_id
    LEFT JOIN pets pet ON spcp.pet_id = pet.id
    WHERE spc.parent_id = p_parent_id
    -- IMPROVED: Handle multi-day blocks that overlap with the requested date range
    -- A block is visible if it starts before the range ends AND ends after the range starts
    AND spc.care_date <= p_end_date
    AND COALESCE(spc.end_date, spc.care_date) >= p_start_date
    AND spc.status = 'confirmed'
    GROUP BY spc.id, g.name, spc.care_date, spc.end_date, spc.start_time, spc.end_time,
             spc.care_type, spc.status, spc.notes, p.full_name, spc.action_type,
             spc.related_request_id, spc.group_id
    ORDER BY spc.care_date, spc.start_time;
END;
$$;

GRANT EXECUTE ON FUNCTION get_scheduled_pet_care_for_calendar(UUID, DATE, DATE) TO authenticated;

-- Verify
DO $$
BEGIN
    RAISE NOTICE '✅ get_scheduled_pet_care_for_calendar updated with end_date support';
    RAISE NOTICE '✅ WHERE clause now handles multi-day blocks correctly';
END;
$$;
