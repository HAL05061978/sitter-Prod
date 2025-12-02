-- =====================================================
-- PET CARE CALENDAR FUNCTION
-- =====================================================
-- RPC function to fetch scheduled pet care for calendar display
-- Mirrors get_scheduled_care_for_calendar but for pets
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
    start_time TIME,
    end_time TIME,
    care_type TEXT,
    status TEXT,
    notes TEXT,
    children_count BIGINT,  -- Aliased from pets_count for compatibility
    providing_parent_name TEXT,
    children_names TEXT[],  -- Aliased from pets_names for compatibility
    action_type TEXT,
    related_request_id UUID,
    group_id UUID,
    children_data JSONB,    -- Added for compatibility
    is_host BOOLEAN
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
        spc.start_time,
        spc.end_time,
        spc.care_type::TEXT,
        spc.status::TEXT,
        spc.notes,
        COUNT(DISTINCT spcp.pet_id) as children_count,  -- Aliased for compatibility
        -- For receiving care blocks, show the actual provider; for providing care blocks, show the parent
        CASE
            WHEN spc.care_type = 'needed' THEN
                -- For 'needed' care, find the corresponding provider from related blocks
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
                -- For 'provided' care, the parent_id is the provider
                p.full_name
            ELSE
                'Unknown'
        END as providing_parent_name,
        -- Show ALL pets involved in this care block (aliased as children_names for compatibility)
        ARRAY_AGG(DISTINCT pet.name::TEXT) as children_names,
        spc.action_type::TEXT,
        spc.related_request_id,
        spc.group_id,
        -- Return pet data as JSON for compatibility with children_data
        jsonb_agg(DISTINCT jsonb_build_object('id', pet.id, 'full_name', pet.name)) FILTER (WHERE pet.id IS NOT NULL) as children_data,
        -- Pet care doesn't have is_host concept, so default to false
        FALSE as is_host
    FROM scheduled_pet_care spc
    JOIN groups g ON spc.group_id = g.id
    JOIN profiles p ON spc.parent_id = p.id
    -- Join with scheduled_pet_care_pets to get ALL pets involved
    LEFT JOIN scheduled_pet_care_pets spcp ON spc.id = spcp.scheduled_pet_care_id
    LEFT JOIN pets pet ON spcp.pet_id = pet.id
    WHERE spc.parent_id = p_parent_id
    AND spc.care_date BETWEEN p_start_date AND p_end_date
    AND spc.status = 'confirmed'
    GROUP BY spc.id, g.name, spc.care_date, spc.start_time, spc.end_time,
             spc.care_type, spc.status, spc.notes, p.full_name, spc.action_type,
             spc.related_request_id, spc.group_id
    ORDER BY spc.care_date, spc.start_time;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_scheduled_pet_care_for_calendar(UUID, DATE, DATE) TO authenticated;

-- =====================================================
-- VERIFICATION
-- =====================================================
DO $$
BEGIN
    RAISE NOTICE '✅ Pet care calendar function created successfully!';
    RAISE NOTICE '✅ Function: get_scheduled_pet_care_for_calendar';
    RAISE NOTICE '✅ Returns scheduled pet care blocks with pet names and provider information';
END;
$$;
