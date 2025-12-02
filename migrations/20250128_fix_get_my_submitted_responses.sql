-- =====================================================
-- FIX GET_MY_SUBMITTED_RESPONSES FUNCTION
-- =====================================================
-- Problem: The function only returns responses with status='submitted',
-- but when responses are accepted or declined, they have status='accepted'
-- or status='declined', so they don't show up in the messages inbox.
--
-- Solution: Update the function to return responses with any status
-- (submitted, pending, accepted, declined) so users can see all their
-- response status updates.
-- =====================================================

DROP FUNCTION IF EXISTS get_my_submitted_responses(UUID);

CREATE OR REPLACE FUNCTION get_my_submitted_responses(parent_id UUID)
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
    reciprocal_child_id UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT
        cr.id as care_response_id,
        cr.request_id as care_request_id,
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
        cr.reciprocal_child_id
    FROM care_responses cr
    JOIN care_requests cq ON cr.request_id = cq.id
    JOIN groups g ON cq.group_id = g.id
    JOIN profiles p ON cq.requester_id = p.id
    WHERE cr.responder_id = parent_id
    AND cr.response_type = 'pending'
    AND cr.status IN ('submitted', 'pending', 'accepted', 'declined')  -- Show all statuses
    AND cq.request_type = 'reciprocal'  -- Only show reciprocal responses, not open block responses
    AND cq.requester_id != parent_id  -- Don't show responses to own requests
    ORDER BY cr.created_at DESC;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_my_submitted_responses(UUID) TO authenticated;
