-- =====================================================
-- PET CARE FUNCTIONS - SIMPLE MIRROR OF CHILD CARE
-- =====================================================
-- This mirrors the working child care functions exactly
-- Only supports reciprocal care workflow (no open blocks)
-- =====================================================

-- =====================================================
-- FUNCTION 1: get_reciprocal_pet_care_requests
-- =====================================================
-- Returns pet care requests that I (the responder) need to respond to
-- Mirrors: get_reciprocal_care_requests for child care

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
    start_time TIME,
    end_time TIME,
    notes TEXT,
    status TEXT,
    created_at TIMESTAMPTZ,
    response_count INTEGER,
    accepted_response_count INTEGER,
    pet_name TEXT,
    end_date DATE
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
        pcrq.start_time,
        pcrq.end_time,
        pcrq.notes,
        pcr.status::TEXT,
        pcr.created_at,
        COALESCE(response_counts.response_count, 0)::INTEGER as response_count,
        COALESCE(response_counts.accepted_response_count, 0)::INTEGER as accepted_response_count,
        pet.name::TEXT as pet_name,
        pcrq.end_date
    FROM pet_care_responses pcr
    JOIN pet_care_requests pcrq ON pcr.request_id = pcrq.id
    JOIN groups g ON pcrq.group_id = g.id
    JOIN profiles p ON pcrq.requester_id = p.id
    LEFT JOIN pets pet ON pcrq.pet_id = pet.id
    LEFT JOIN (
        SELECT
            request_id,
            COUNT(*)::INTEGER as response_count,
            COUNT(*) FILTER (WHERE pet_care_responses.status = 'accepted')::INTEGER as accepted_response_count
        FROM pet_care_responses
        GROUP BY request_id
    ) response_counts ON pcrq.id = response_counts.request_id
    WHERE pcr.responder_id = p_parent_id
    AND pcr.response_type = 'pending'
    AND pcr.status = 'pending'  -- ONLY pending (not submitted)
    AND pcrq.request_type = 'reciprocal'
    AND pcrq.requester_id != p_parent_id  -- Don't show responses to own requests
    ORDER BY pcr.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION get_reciprocal_pet_care_requests(UUID) TO authenticated;

-- =====================================================
-- FUNCTION 2: get_reciprocal_pet_care_responses
-- =====================================================
-- Returns responses to MY pet care requests that I need to accept/decline
-- Mirrors: get_reciprocal_care_responses for child care

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
    pet_name TEXT,
    end_date DATE
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
        pcrq.start_time,
        pcrq.end_time,
        pcrq.notes,
        pcr.status::TEXT,
        pcr.created_at,
        pcr.reciprocal_date,
        pcr.reciprocal_start_time,
        pcr.reciprocal_end_time,
        pcr.response_notes,
        pcr.responder_id,
        rp.full_name as responder_name,
        pet.name::TEXT as pet_name,
        pcrq.end_date
    FROM pet_care_responses pcr
    JOIN pet_care_requests pcrq ON pcr.request_id = pcrq.id
    JOIN groups g ON pcrq.group_id = g.id
    JOIN profiles p ON pcrq.requester_id = p.id
    LEFT JOIN profiles rp ON pcr.responder_id = rp.id
    LEFT JOIN pets pet ON pcrq.pet_id = pet.id
    WHERE pcrq.requester_id = p_parent_id
    AND pcr.response_type = 'pending'
    AND pcr.status IN ('submitted', 'accepted', 'declined')
    AND pcrq.request_type = 'reciprocal'
    ORDER BY pcr.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION get_reciprocal_pet_care_responses(UUID) TO authenticated;

-- =====================================================
-- VERIFICATION
-- =====================================================
DO $$
BEGIN
    RAISE NOTICE '✅ Pet care functions created - mirroring child care workflow';
    RAISE NOTICE '✅ get_reciprocal_pet_care_requests - shows requests I need to respond to';
    RAISE NOTICE '✅ get_reciprocal_pet_care_responses - shows responses to MY requests';
    RAISE NOTICE '✅ Both functions mirror child care exactly';
END $$;
