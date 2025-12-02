-- =====================================================
-- CREATE get_pet_care_responses_for_requester
-- =====================================================
-- Mirror of get_responses_for_requester but for pet care
-- Shows responses to MY pet care requests (when I'm the requester)
-- =====================================================

CREATE OR REPLACE FUNCTION get_pet_care_responses_for_requester(p_requester_id UUID)
RETURNS TABLE(
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
    created_at TIMESTAMP WITH TIME ZONE,
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
        pcr.id as care_response_id,
        pcr.request_id as care_request_id,
        pcrq.group_id,
        g.name as group_name,
        pcrq.requester_id,
        p.full_name as requester_name,
        pcrq.requested_date,
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
        rp.full_name as responder_name
    FROM pet_care_responses pcr
    JOIN pet_care_requests pcrq ON pcr.request_id = pcrq.id
    JOIN groups g ON pcrq.group_id = g.id
    JOIN profiles p ON pcrq.requester_id = p.id
    LEFT JOIN profiles rp ON pcr.responder_id = rp.id
    WHERE pcrq.requester_id = p_requester_id
    AND pcr.status IN ('submitted', 'accepted', 'declined')
    ORDER BY pcr.created_at DESC;
END;
$$;
