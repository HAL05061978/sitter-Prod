-- Fix get_reciprocal_care_requests to properly return invitations for responders
-- This function should return care requests where the current user needs to respond

DROP FUNCTION IF EXISTS get_reciprocal_care_requests(UUID);

CREATE OR REPLACE FUNCTION get_reciprocal_care_requests(parent_id UUID)
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
    accepted_response_count INTEGER
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
        COALESCE(response_counts.response_count, 0) as response_count,
        COALESCE(response_counts.accepted_response_count, 0) as accepted_response_count
    FROM care_responses cr
    JOIN care_requests cq ON cr.request_id = cq.id
    JOIN groups g ON cq.group_id = g.id
    JOIN profiles p ON cq.requester_id = p.id
    LEFT JOIN (
        SELECT
            request_id,
            COUNT(*) as response_count,
            COUNT(*) FILTER (WHERE status = 'accepted') as accepted_response_count
        FROM care_responses
        GROUP BY request_id
    ) response_counts ON cq.id = response_counts.request_id
    WHERE cr.responder_id = parent_id
    AND cr.response_type = 'pending'
    AND cr.status IN ('pending', 'submitted')  -- Include both pending and submitted responses
    AND cq.request_type = 'reciprocal'
    AND cq.requester_id != parent_id
    ORDER BY cr.created_at DESC;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_reciprocal_care_requests(UUID) TO authenticated;
