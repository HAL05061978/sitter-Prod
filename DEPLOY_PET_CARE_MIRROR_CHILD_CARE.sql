-- Mirror the EXACT child care function logic for pet care
-- This ensures pet care works identically to child care

-- =====================================================
-- Fix 1: get_reciprocal_pet_care_requests
-- EXACT mirror of get_reciprocal_care_requests
-- Returns: Requests I MADE (where I'm requester)
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
    requested_end_date DATE,  -- Pet care has end_date
    start_time TIME,
    end_time TIME,
    notes TEXT,
    status VARCHAR,
    created_at TIMESTAMPTZ,
    response_count BIGINT,
    accepted_response_count BIGINT,
    pet_id UUID,
    pet_name VARCHAR(255),
    reciprocal_pet_id UUID,
    reciprocal_pet_name VARCHAR(255),
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
        COALESCE(response_counts.response_count, 0) as response_count,
        COALESCE(response_counts.accepted_response_count, 0) as accepted_response_count,
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
            pcr2.request_id,
            COUNT(*) as response_count,
            COUNT(*) FILTER (WHERE pcr2.status = 'accepted') as accepted_response_count
        FROM pet_care_responses pcr2
        GROUP BY pcr2.request_id
    ) response_counts ON pcrq.id = response_counts.request_id
    WHERE pcrq.requester_id = p_parent_id  -- I am the REQUESTER (same as child care)
    AND pcr.response_type = 'pending'
    AND pcr.status IN ('pending', 'submitted')  -- EXACT same as child care
    AND pcrq.request_type = 'reciprocal'
    ORDER BY pcr.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION get_reciprocal_pet_care_requests(UUID) TO authenticated;

-- =====================================================
-- Fix 2: get_reciprocal_pet_care_responses
-- EXACT mirror of get_reciprocal_care_responses
-- Returns: Invitations I RECEIVED (where I'm responder)
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
    requested_end_date DATE,  -- Pet care has end_date
    start_time TIME,
    end_time TIME,
    notes TEXT,
    status VARCHAR,
    created_at TIMESTAMPTZ,
    reciprocal_date DATE,
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
    WHERE pcr.responder_id = p_parent_id  -- I am the RESPONDER (same as child care)
    AND pcr.response_type = 'pending'
    AND pcr.status IN ('pending', 'submitted', 'accepted', 'declined')  -- EXACT same as child care
    AND pcrq.request_type = 'reciprocal'
    AND pcrq.requester_id != p_parent_id  -- Don't show my own requests (same as child care)
    ORDER BY pcr.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION get_reciprocal_pet_care_responses(UUID) TO authenticated;
