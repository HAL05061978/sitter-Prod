-- =====================================================
-- GET PET CARE RESPONSES FOR REQUESTER FUNCTION
-- =====================================================
-- This function gets pet care responses to requests made by the user
-- Mirrors the child care get_responses_for_requester function
-- Called by Header.tsx for notification counter

DROP FUNCTION IF EXISTS get_pet_care_responses_for_requester(UUID);

CREATE OR REPLACE FUNCTION get_pet_care_responses_for_requester(
    p_requester_id UUID
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
    reciprocal_date DATE,
    reciprocal_start_time TIME,
    reciprocal_end_time TIME,
    response_notes TEXT,
    responder_id UUID,
    responder_name TEXT,
    pet_id UUID,
    pet_name TEXT,
    reciprocal_pet_id UUID,
    reciprocal_pet_name TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RAISE NOTICE '=== GETTING PET CARE RESPONSES FOR REQUESTER ===';
    RAISE NOTICE 'Requester ID: %', p_requester_id;

    RETURN QUERY
    SELECT
        pcr.id as care_response_id,
        pcrq.id as care_request_id,
        pcrq.group_id,
        g.name::TEXT as group_name,
        pcrq.requester_id,
        p.full_name::TEXT as requester_name,
        pcrq.requested_date,
        pcrq.end_date as requested_end_date,
        pcrq.start_time,
        pcrq.end_time,
        pcrq.notes::TEXT,
        pcr.status::TEXT,
        pcr.created_at,
        pcr.reciprocal_date,
        pcr.reciprocal_start_time,
        pcr.reciprocal_end_time,
        pcr.response_notes::TEXT,
        pcr.responder_id,
        rp.full_name::TEXT as responder_name,
        pcrq.pet_id,
        pet.name::TEXT as pet_name,
        pcr.reciprocal_pet_id,
        rpet.name::TEXT as reciprocal_pet_name
    FROM pet_care_responses pcr
    JOIN pet_care_requests pcrq ON pcr.request_id = pcrq.id
    JOIN groups g ON pcrq.group_id = g.id
    JOIN profiles p ON pcrq.requester_id = p.id
    LEFT JOIN profiles rp ON pcr.responder_id = rp.id
    LEFT JOIN pets pet ON pcrq.pet_id = pet.id
    LEFT JOIN pets rpet ON pcr.reciprocal_pet_id = rpet.id
    WHERE pcrq.requester_id = p_requester_id
    AND pcr.response_type = 'pending'  -- FIXED: Only count pending responses (matches child care)
    AND pcr.status IN ('submitted', 'accepted', 'declined')  -- FIXED: Exclude 'pending' status (matches child care)
    AND pcrq.request_type = 'reciprocal'  -- FIXED: Only reciprocal requests (matches child care)
    ORDER BY pcr.created_at DESC;

    RAISE NOTICE 'Returned % pet care responses', (SELECT COUNT(*) FROM pet_care_responses pcr JOIN pet_care_requests pcrq ON pcr.request_id = pcrq.id WHERE pcrq.requester_id = p_requester_id);
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_pet_care_responses_for_requester(UUID) TO authenticated;

-- Success message
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ get_pet_care_responses_for_requester function created successfully!';
    RAISE NOTICE '✅ FIXED: ALL VARCHAR columns cast to TEXT (names, notes, status)';
    RAISE NOTICE '✅ FIXED: Correct filters for counter';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
END $$;
