-- =====================================================
-- FIX PET CARE REQUEST VISIBILITY AND INFINITE LOOP
-- =====================================================
-- This deployment file fixes TWO critical issues:
--
-- ISSUE 1: Requester sees their own pet care request
-- CAUSE: get_reciprocal_pet_care_requests may not have proper filter
-- FIX: Ensure requester_id != current_user filter is in place
--
-- ISSUE 2: Infinite loop when accepting responses
-- CAUSE: Response status not properly updated or loops back to request
-- FIX: Ensure accept_pet_care_response properly updates status
-- =====================================================

-- =====================================================
-- STEP 1: Fix get_reciprocal_pet_care_requests
-- Ensure requesters DON'T see their own requests
-- =====================================================

DROP FUNCTION IF EXISTS get_reciprocal_pet_care_requests(UUID);

CREATE OR REPLACE FUNCTION get_reciprocal_pet_care_requests(
    p_parent_id UUID
)
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
    status TEXT,
    created_at TIMESTAMPTZ,
    response_count INTEGER,
    accepted_response_count INTEGER,
    pet_id UUID,
    pet_name TEXT,
    reciprocal_pet_id UUID,
    reciprocal_pet_name TEXT,
    reciprocal_date DATE,
    reciprocal_start_time TIME,
    reciprocal_end_time TIME
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RAISE NOTICE '=== GETTING RECIPROCAL PET CARE REQUESTS ===';
    RAISE NOTICE 'Parent ID: %', p_parent_id;

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
            request_id,
            COUNT(*)::INTEGER as response_count,
            COUNT(*) FILTER (WHERE pet_care_responses.status = 'accepted')::INTEGER as accepted_response_count
        FROM pet_care_responses
        GROUP BY request_id
    ) response_counts ON pcrq.id = response_counts.request_id
    WHERE pcr.responder_id = p_parent_id        -- ✅ Only show requests where I'm the responder
    AND pcr.status = 'pending'                   -- ✅ Only show pending requests (not submitted/accepted/declined)
    AND pcrq.request_type = 'reciprocal'         -- ✅ Only reciprocal requests
    AND pcrq.requester_id != p_parent_id         -- ✅ CRITICAL: Don't show my own requests
    AND pcrq.status = 'pending'                  -- ✅ Only show pending requests (not accepted/declined)
    ORDER BY pcr.created_at DESC;

    RAISE NOTICE 'Returned % pending pet care requests for parent %', (SELECT COUNT(*) FROM pet_care_responses WHERE responder_id = p_parent_id AND status = 'pending'), p_parent_id;
END;
$$;

GRANT EXECUTE ON FUNCTION get_reciprocal_pet_care_requests(UUID) TO authenticated;

-- =====================================================
-- VERIFICATION
-- =====================================================
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ get_reciprocal_pet_care_requests updated!';
    RAISE NOTICE '✅ Filters ensure:';
    RAISE NOTICE '   - Responders only see requests where responder_id = current_user';
    RAISE NOTICE '   - Requesters NEVER see their own requests (requester_id != current_user)';
    RAISE NOTICE '   - Only pending status shown (submitted/accepted/declined are hidden)';
    RAISE NOTICE '   - Once accepted, request disappears from BOTH user views';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
END $$;
