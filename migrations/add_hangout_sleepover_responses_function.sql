-- =====================================================
-- ADD FUNCTION TO GET HANGOUT/SLEEPOVER RESPONSES
-- =====================================================
-- This function returns hangout and sleepover invitations for the Messages counter

CREATE OR REPLACE FUNCTION get_hangout_sleepover_responses(p_parent_id UUID)
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
    end_date DATE,
    request_type TEXT,
    notes TEXT,
    status TEXT,
    created_at TIMESTAMPTZ,
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
        cq.end_date,
        cq.request_type,
        cq.notes,
        cr.status,
        cr.created_at,
        cr.response_notes,
        cr.responder_id,
        rp.full_name as responder_name
    FROM care_responses cr
    JOIN care_requests cq ON cr.request_id = cq.id
    JOIN groups g ON cq.group_id = g.id
    JOIN profiles p ON cq.requester_id = p.id
    LEFT JOIN profiles rp ON cr.responder_id = rp.id
    WHERE cr.responder_id = p_parent_id
    AND cr.status = 'pending'  -- Only pending invitations
    AND cq.request_type IN ('hangout', 'sleepover')  -- Only hangout/sleepover types
    ORDER BY cr.created_at DESC;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_hangout_sleepover_responses(UUID) TO authenticated;

COMMENT ON FUNCTION get_hangout_sleepover_responses IS 'Returns pending hangout and sleepover invitations for a parent to enable Messages counter';
