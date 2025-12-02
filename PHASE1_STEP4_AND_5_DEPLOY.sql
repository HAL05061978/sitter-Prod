-- =====================================================
-- PHASE 1 STEPS 4-5: Complete reciprocal_end_date Support
-- =====================================================
-- Add reciprocal_end_date to pet_care_requests table and
-- update the get_reciprocal_pet_care_requests function
--
-- WHY NEEDED:
-- - pet_care_responses stores the OFFER (reciprocal_end_date)
-- - pet_care_requests stores the AGREED reciprocal after acceptance
-- - Both need reciprocal_end_date for multi-day support
-- =====================================================

BEGIN;

-- =====================================================
-- STEP 4: Add reciprocal_end_date to pet_care_requests
-- =====================================================
ALTER TABLE pet_care_requests
ADD COLUMN IF NOT EXISTS reciprocal_end_date DATE;

COMMENT ON COLUMN pet_care_requests.reciprocal_end_date IS
'End date for the agreed reciprocal pet care. Populated when a response is accepted. If NULL, reciprocal care is single-day (same as reciprocal_date).';

-- =====================================================
-- STEP 5: Update get_reciprocal_pet_care_requests
-- =====================================================
DROP FUNCTION IF EXISTS get_reciprocal_pet_care_requests(UUID);

CREATE OR REPLACE FUNCTION get_reciprocal_pet_care_requests(p_parent_id UUID)
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
    response_count INTEGER,
    accepted_response_count INTEGER,
    pet_id UUID,
    pet_name VARCHAR(255),
    reciprocal_pet_id UUID,
    reciprocal_pet_name VARCHAR(255),
    reciprocal_date DATE,
    reciprocal_end_date DATE,
    reciprocal_start_time TIME,
    reciprocal_end_time TIME
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
        COALESCE(response_counts.response_count, 0)::INTEGER as response_count,
        COALESCE(response_counts.accepted_response_count, 0)::INTEGER as accepted_response_count,
        pcrq.pet_id,
        pet.name as pet_name,
        pcrq.reciprocal_pet_id,
        rpet.name as reciprocal_pet_name,
        pcrq.reciprocal_date,
        pcrq.reciprocal_end_date,
        pcrq.reciprocal_start_time,
        pcrq.reciprocal_end_time
    FROM pet_care_responses pcr
    JOIN pet_care_requests pcrq ON pcr.request_id = pcrq.id
    JOIN groups g ON pcrq.group_id = g.id
    JOIN profiles p ON pcrq.requester_id = p.id
    LEFT JOIN pets pet ON pcrq.pet_id = pet.id
    LEFT JOIN pets rpet ON pcrq.reciprocal_pet_id = rpet.id
    LEFT JOIN (
        SELECT
            pcr2.request_id,
            COUNT(*)::INTEGER as response_count,
            COUNT(*) FILTER (WHERE pcr2.status = 'accepted')::INTEGER as accepted_response_count
        FROM pet_care_responses pcr2
        GROUP BY pcr2.request_id
    ) response_counts ON pcrq.id = response_counts.request_id
    WHERE pcrq.requester_id = p_parent_id
    AND pcr.response_type = 'pending'
    AND pcr.status IN ('pending', 'submitted')
    AND pcrq.request_type = 'reciprocal'
    ORDER BY pcr.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION get_reciprocal_pet_care_requests(UUID) TO authenticated;

-- =====================================================
-- VERIFICATION
-- =====================================================
DO $$
DECLARE
    v_requests_column_exists BOOLEAN;
    v_responses_column_exists BOOLEAN;
BEGIN
    -- Check pet_care_requests column
    SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'pet_care_requests'
        AND column_name = 'reciprocal_end_date'
    ) INTO v_requests_column_exists;

    -- Check pet_care_responses column (from earlier step)
    SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'pet_care_responses'
        AND column_name = 'reciprocal_end_date'
    ) INTO v_responses_column_exists;

    IF v_requests_column_exists AND v_responses_column_exists THEN
        RAISE NOTICE '✅ PHASE 1 STEPS 4-5 DEPLOYMENT SUCCESSFUL!';
        RAISE NOTICE '';
        RAISE NOTICE 'SUMMARY: reciprocal_end_date now exists in:';
        RAISE NOTICE '  ✅ pet_care_responses (for offers from responders)';
        RAISE NOTICE '  ✅ pet_care_requests (for agreed reciprocal after acceptance)';
        RAISE NOTICE '  ✅ get_reciprocal_pet_care_requests (returns the end date)';
        RAISE NOTICE '  ✅ get_reciprocal_pet_care_responses (returns the end date)';
        RAISE NOTICE '  ✅ get_scheduled_pet_care_for_calendar (returns the end date)';
        RAISE NOTICE '';
        RAISE NOTICE '🎉 PHASE 1 DATABASE MIGRATION COMPLETE!';
        RAISE NOTICE '';
        RAISE NOTICE 'NEXT: Phase 2 (Frontend updates to use multi-day dates)';
    ELSE
        IF NOT v_responses_column_exists THEN
            RAISE EXCEPTION '❌ Missing: pet_care_responses.reciprocal_end_date - Run PHASE1_DEPLOY_ALL.sql first';
        END IF;
        IF NOT v_requests_column_exists THEN
            RAISE EXCEPTION '❌ Failed to add pet_care_requests.reciprocal_end_date';
        END IF;
    END IF;
END;
$$;

COMMIT;
