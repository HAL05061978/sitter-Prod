-- =====================================================
-- FIX BOTH PET CARE FUNCTIONS - NO SUBQUERIES
-- =====================================================
-- This creates both functions with no subqueries to avoid
-- any possible ambiguous column errors
-- =====================================================

-- FUNCTION 1: get_reciprocal_pet_care_requests
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
    RETURN QUERY
    SELECT
        pcr.id,
        pcrq.id,
        pcrq.group_id,
        g.name,
        pcrq.requester_id,
        p.full_name,
        pcrq.requested_date,
        pcrq.end_date,
        pcrq.start_time,
        pcrq.end_time,
        pcrq.notes,
        pcr.status,
        pcr.created_at,
        0::INTEGER,
        0::INTEGER,
        pcrq.pet_id,
        pet.name,
        pcrq.reciprocal_pet_id,
        rpet.name,
        pcrq.reciprocal_date,
        pcrq.reciprocal_start_time,
        pcrq.reciprocal_end_time
    FROM pet_care_responses pcr
    JOIN pet_care_requests pcrq ON pcr.request_id = pcrq.id
    JOIN groups g ON pcrq.group_id = g.id
    JOIN profiles p ON pcrq.requester_id = p.id
    LEFT JOIN pets pet ON pcrq.pet_id = pet.id
    LEFT JOIN pets rpet ON pcrq.reciprocal_pet_id = rpet.id
    WHERE pcr.responder_id = p_parent_id
    AND pcr.status = 'pending'
    AND pcrq.request_type = 'reciprocal'
    AND pcrq.requester_id != p_parent_id
    ORDER BY pcr.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION get_reciprocal_pet_care_requests(UUID) TO authenticated;

-- FUNCTION 2: get_reciprocal_pet_care_responses
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
    status TEXT,
    created_at TIMESTAMPTZ,
    reciprocal_date DATE,
    reciprocal_start_time TIME,
    reciprocal_end_time TIME,
    response_notes TEXT,
    responder_id UUID,
    responder_name TEXT,
    pet_id UUID,
    pet_name TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT
        pcr.id,
        pcrq.id,
        pcrq.group_id,
        g.name,
        pcrq.requester_id,
        requester.full_name,
        pcrq.requested_date,
        pcrq.end_date,
        pcrq.start_time,
        pcrq.end_time,
        pcrq.notes,
        pcr.status,
        pcr.created_at,
        pcr.reciprocal_date,
        pcr.reciprocal_start_time,
        pcr.reciprocal_end_time,
        pcr.response_notes,
        pcr.responder_id,
        responder.full_name,
        pcrq.pet_id,
        pet.name
    FROM pet_care_responses pcr
    JOIN pet_care_requests pcrq ON pcr.request_id = pcrq.id
    JOIN groups g ON pcrq.group_id = g.id
    JOIN profiles requester ON pcrq.requester_id = requester.id
    JOIN profiles responder ON pcr.responder_id = responder.id
    LEFT JOIN pets pet ON pcrq.pet_id = pet.id
    WHERE pcr.responder_id = p_parent_id
    AND pcr.status IN ('submitted', 'accepted', 'declined')
    AND pcrq.request_type = 'reciprocal'
    ORDER BY pcr.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION get_reciprocal_pet_care_responses(UUID) TO authenticated;

-- Verification
DO $$
BEGIN
    RAISE NOTICE '✅ Both pet care functions created successfully!';
    RAISE NOTICE '✅ get_reciprocal_pet_care_requests - for viewing pending requests';
    RAISE NOTICE '✅ get_reciprocal_pet_care_responses - for viewing your responses';
    RAISE NOTICE '✅ No subqueries = no ambiguous column errors possible';
END $$;
