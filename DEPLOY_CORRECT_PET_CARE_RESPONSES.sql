-- CORRECT FIX for get_reciprocal_pet_care_responses
-- The function name is MISLEADING - it actually returns responses to MY requests where I'm requester
-- NOT invitations where I'm the responder
-- This matches the child care function behavior

-- The frontend filters this data at line 734 with .filter(response => response.status === 'pending')
-- to show "Respond to Request" messages
-- But it should NOT show pending responses to MY OWN requests!
-- Those pending responses are waiting for OTHER people to submit

-- The REAL problem: Child care is returning 0 responses for Hugo (console line 28)
-- But pet care is returning 3 responses for Hugo (console line 27)
-- Both functions have the same WHERE clause: WHERE requester_id = parent_id

-- This suggests the child care function was ALREADY fixed in production to filter by responder_id
-- But the WriteUps folder has the OLD version

-- So the correct fix is to make pet care match the ACTUAL production child care function:

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
    WHERE pcr.responder_id = p_parent_id  -- I am the RESPONDER (invitations for me)
    AND pcr.response_type = 'pending'
    AND pcr.status IN ('pending', 'submitted', 'accepted', 'declined')
    AND pcrq.request_type = 'reciprocal'
    AND pcrq.requester_id != p_parent_id  -- Don't show my own requests
    ORDER BY pcr.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION get_reciprocal_pet_care_responses(UUID) TO authenticated;
