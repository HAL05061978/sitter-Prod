-- =====================================================
-- PHASE 1: COMPLETE DATABASE MIGRATION
-- =====================================================
-- Deploy all Phase 1 changes in one transaction for safety
-- This adds multi-day support to pet care without breaking anything
--
-- ROLLBACK PLAN: If anything fails, entire transaction rolls back
-- =====================================================

BEGIN;

-- =====================================================
-- STEP 1: Add reciprocal_end_date column
-- =====================================================
ALTER TABLE pet_care_responses
ADD COLUMN IF NOT EXISTS reciprocal_end_date DATE;

COMMENT ON COLUMN pet_care_responses.reciprocal_end_date IS
'End date for multi-day reciprocal pet care offers. If NULL, reciprocal care is single-day (same as reciprocal_date).';

-- =====================================================
-- STEP 2: Update get_reciprocal_pet_care_responses
-- =====================================================
DROP FUNCTION IF EXISTS get_reciprocal_pet_care_responses(UUID);

CREATE OR REPLACE FUNCTION get_reciprocal_pet_care_responses(p_parent_id UUID)
RETURNS TABLE (
    care_response_id UUID,
    care_request_id UUID,
    group_id UUID,
    group_name TEXT,
    requester_id UUID,
    requester_name TEXT,
    requested_date DATE,
    requested_end_date DATE,
    start_time TIME,
    end_time TIME,
    notes TEXT,
    status VARCHAR,
    created_at TIMESTAMPTZ,
    reciprocal_date DATE,
    reciprocal_end_date DATE,
    reciprocal_start_time TIME,
    reciprocal_end_time TIME,
    response_notes TEXT,
    responder_id UUID,
    responder_name TEXT,
    pet_id UUID,
    pet_name VARCHAR(255),
    reciprocal_pet_id UUID,
    reciprocal_pet_name VARCHAR(255)
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT
        pcr.id as care_response_id,
        pcrq.id as care_request_id,
        pcrq.group_id,
        g.name as group_name,
        pcrq.requester_id,
        p.full_name as requester_name,
        pcrq.requested_date,
        pcrq.end_date as requested_end_date,
        pcrq.start_time,
        pcrq.end_time,
        pcrq.notes,
        pcr.status,
        pcr.created_at,
        pcr.reciprocal_date,
        pcr.reciprocal_end_date,
        pcr.reciprocal_start_time,
        pcr.reciprocal_end_time,
        pcr.response_notes,
        pcr.responder_id,
        rp.full_name as responder_name,
        pcrq.pet_id,
        pet.name as pet_name,
        pcr.reciprocal_pet_id,
        rpet.name as reciprocal_pet_name
    FROM pet_care_responses pcr
    JOIN pet_care_requests pcrq ON pcr.request_id = pcrq.id
    JOIN groups g ON pcrq.group_id = g.id
    JOIN profiles p ON pcrq.requester_id = p.id
    LEFT JOIN profiles rp ON pcr.responder_id = rp.id
    LEFT JOIN pets pet ON pcrq.pet_id = pet.id
    LEFT JOIN pets rpet ON pcr.reciprocal_pet_id = rpet.id
    WHERE pcr.responder_id = p_parent_id
    AND pcr.response_type = 'pending'
    AND pcr.status IN ('pending', 'submitted', 'accepted', 'declined')
    AND pcrq.request_type = 'reciprocal'
    AND pcrq.requester_id != p_parent_id
    ORDER BY pcr.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION get_reciprocal_pet_care_responses(UUID) TO authenticated;

-- =====================================================
-- STEP 3: Update get_scheduled_pet_care_for_calendar
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
    end_date DATE,
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
        spc.end_date,
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

-- =====================================================
-- VERIFICATION
-- =====================================================
DO $$
DECLARE
    v_column_exists BOOLEAN;
    v_function_exists BOOLEAN;
BEGIN
    -- Check column
    SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'pet_care_responses'
        AND column_name = 'reciprocal_end_date'
    ) INTO v_column_exists;

    -- Check function
    SELECT EXISTS (
        SELECT 1
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public'
        AND p.proname = 'get_scheduled_pet_care_for_calendar'
    ) INTO v_function_exists;

    IF v_column_exists AND v_function_exists THEN
        RAISE NOTICE '✅ PHASE 1 DEPLOYMENT SUCCESSFUL!';
        RAISE NOTICE '✅ Column: pet_care_responses.reciprocal_end_date added';
        RAISE NOTICE '✅ Function: get_reciprocal_pet_care_responses updated';
        RAISE NOTICE '✅ Function: get_scheduled_pet_care_for_calendar updated';
        RAISE NOTICE '';
        RAISE NOTICE 'NEXT STEPS:';
        RAISE NOTICE '1. Test existing pet care workflow (should work unchanged)';
        RAISE NOTICE '2. Proceed to Phase 2 when ready (frontend updates)';
    ELSE
        RAISE EXCEPTION '❌ PHASE 1 DEPLOYMENT FAILED - See errors above';
    END IF;
END;
$$;

COMMIT;
