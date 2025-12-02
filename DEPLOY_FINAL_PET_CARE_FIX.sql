-- FINAL PET CARE FIX - Exact mirror of working child care functions
-- This replaces both pet care functions with the correct logic

-- =====================================================
-- Fix 1: get_reciprocal_pet_care_requests
-- Should return: MY requests (where I'm requester)
-- Mirrors: get_reciprocal_care_requests logic
-- =====================================================

DROP FUNCTION IF EXISTS get_reciprocal_pet_care_requests(UUID);

CREATE OR REPLACE FUNCTION get_reciprocal_pet_care_requests(p_parent_id UUID)
RETURNS TABLE (
    care_request_id UUID,
    group_id UUID,
    group_name TEXT,
    requester_id UUID,
    requester_name TEXT,
    requested_date DATE,
    requested_end_date DATE,  -- Pet care specific
    start_time TIME,
    end_time TIME,
    notes TEXT,
    status VARCHAR,
    created_at TIMESTAMPTZ,
    response_count INTEGER,
    accepted_response_count INTEGER,
    pet_id UUID,  -- Pet care specific
    pet_name VARCHAR(255),  -- Pet care specific
    reciprocal_pet_id UUID,  -- Pet care specific
    reciprocal_pet_name VARCHAR(255),  -- Pet care specific
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
        pcr.id as care_request_id,
        pcr.group_id,
        g.name as group_name,
        pcr.requester_id,
        p.full_name as requester_name,
        pcr.requested_date,
        pcr.end_date as requested_end_date,
        pcr.start_time,
        pcr.end_time,
        pcr.notes,
        pcr.status,
        pcr.created_at,
        COUNT(pcresp.id)::INTEGER as response_count,
        COUNT(CASE WHEN pcresp.status = 'accepted' THEN 1 END)::INTEGER as accepted_response_count,
        pcr.pet_id,
        pet.name as pet_name,
        pcr.reciprocal_pet_id,
        rpet.name as reciprocal_pet_name,
        pcr.reciprocal_date,
        pcr.reciprocal_start_time,
        pcr.reciprocal_end_time
    FROM pet_care_requests pcr
    JOIN groups g ON pcr.group_id = g.id
    JOIN profiles p ON pcr.requester_id = p.id
    LEFT JOIN pets pet ON pcr.pet_id = pet.id
    LEFT JOIN pets rpet ON pcr.reciprocal_pet_id = rpet.id
    LEFT JOIN pet_care_responses pcresp ON pcr.id = pcresp.request_id
    WHERE pcr.requester_id = get_reciprocal_pet_care_requests.p_parent_id  -- FIXED: Now returns MY requests
    AND pcr.is_reciprocal = true
    GROUP BY pcr.id, g.name, p.full_name, pet.name, rpet.name
    ORDER BY pcr.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION get_reciprocal_pet_care_requests(UUID) TO authenticated;

-- =====================================================
-- Fix 2: get_reciprocal_pet_care_responses
-- Should return: Responses to MY requests (where I'm requester)
-- Mirrors: get_reciprocal_care_responses logic
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
    requested_end_date DATE,  -- Pet care specific
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
    pet_id UUID,  -- Pet care specific
    pet_name VARCHAR(255),  -- Pet care specific
    reciprocal_pet_id UUID,  -- Pet care specific
    reciprocal_pet_name VARCHAR(255)  -- Pet care specific
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
    WHERE pcr.responder_id = p_parent_id  -- Returns invitations where I'M the responder
    AND pcr.response_type = 'pending'
    AND pcr.status IN ('pending', 'submitted', 'accepted', 'declined')  -- EXACT same as child care
    AND pcrq.request_type = 'reciprocal'
    AND pcrq.requester_id != p_parent_id  -- Don't show my own requests
    ORDER BY pcr.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION get_reciprocal_pet_care_responses(UUID) TO authenticated;
