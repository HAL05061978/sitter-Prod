-- =====================================================
-- DEPLOY STEP 1 - CORRECTED VERSION
-- =====================================================
-- FIX: Also include response_type = 'accept' (not just 'pending')
--
-- INSTRUCTIONS:
-- 1. Open Supabase Dashboard > SQL Editor
-- 2. Click "New Query"
-- 3. Copy this entire file and paste it
-- 4. Click "Run" (or press Ctrl+Enter)
-- 5. You should see "Success. No rows returned"
-- 6. Refresh your app and check if messages now appear
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
    AND cr.response_type IN ('pending', 'accept')  -- FIXED: Include both 'pending' AND 'accept'
    AND cr.status IN ('submitted', 'pending', 'accepted', 'declined')  -- Show all statuses
    AND cq.request_type = 'reciprocal'
    AND cq.requester_id != parent_id
    ORDER BY cr.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION get_my_submitted_responses(UUID) TO authenticated;

-- =====================================================
-- SUCCESS!
-- =====================================================
-- If you see "Success. No rows returned" above, it worked!
-- Now refresh your app and check the scheduler inbox for messages
-- =====================================================
