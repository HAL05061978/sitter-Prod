-- Fix get_reciprocal_pet_care_responses to include 'pending' status
-- This matches the child care function fix

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
    RAISE NOTICE '=== GETTING RECIPROCAL PET CARE RESPONSES ===';
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
    WHERE pcrq.requester_id = p_parent_id
    AND pcr.response_type = 'pending'
    AND pcr.status IN ('pending', 'submitted', 'accepted', 'declined')  -- ADDED 'pending'
    AND pcrq.request_type = 'reciprocal'
    ORDER BY pcr.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION get_reciprocal_pet_care_responses(UUID) TO authenticated;
