-- Fix get_reciprocal_care_responses to include 'pending' status
-- This function returns responses to MY requests (where I am the requester)
-- It needs to include 'pending' status so I can see who has responded

DROP FUNCTION IF EXISTS get_reciprocal_care_responses(UUID);

CREATE OR REPLACE FUNCTION get_reciprocal_care_responses(parent_id UUID)
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
    responder_name TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT
        cr.id as care_response_id,
        cq.id as care_request_id,
        cq.group_id,
        g.name as group_name,
        cq.requester_id,
        p.full_name as requester_name,
        cq.requested_date,
        cq.start_time,
        cq.end_time,
        cq.notes,
        cr.status,
        cr.created_at,
        cr.reciprocal_date,
        cr.reciprocal_start_time,
        cr.reciprocal_end_time,
        cr.response_notes,
        cr.responder_id,
        rp.full_name as responder_name
    FROM care_responses cr
    JOIN care_requests cq ON cr.request_id = cq.id
    JOIN groups g ON cq.group_id = g.id
    JOIN profiles p ON cq.requester_id = p.id
    LEFT JOIN profiles rp ON cr.responder_id = rp.id
    WHERE cq.requester_id = parent_id
    AND cr.response_type = 'pending'
    AND cr.status IN ('pending', 'submitted', 'accepted', 'declined')  -- ADDED 'pending' here
    AND cq.request_type = 'reciprocal'
    ORDER BY cr.created_at DESC;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_reciprocal_care_responses(UUID) TO authenticated;
