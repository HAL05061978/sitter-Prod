-- =====================================================
-- ADD RECIPROCAL RESPONSE NOTIFICATIONS
-- =====================================================
-- This migration updates the accept_reciprocal_care_response function
-- to send notifications to responders when their response is accepted
-- or not accepted.
-- =====================================================

DROP FUNCTION IF EXISTS accept_reciprocal_care_response(UUID);

CREATE OR REPLACE FUNCTION accept_reciprocal_care_response(
    p_care_response_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_care_response RECORD;
    v_requester_id UUID;
    v_responder_id UUID;
    v_group_id UUID;
    v_requester_child_id UUID;
    v_responder_child_id UUID;
    v_reciprocal_scheduled_care_id UUID;
    v_original_scheduled_care_id UUID;
BEGIN
    RAISE NOTICE '=== ACCEPTING RECIPROCAL CARE RESPONSE ===';
    RAISE NOTICE 'Care Response ID: %', p_care_response_id;

    -- Get the care response details
    SELECT
        cr.*,
        crr.requester_id,
        crr.group_id,
        crr.child_id as requester_child_id,
        crr.requested_date,
        crr.start_time,
        crr.end_time
    INTO v_care_response
    FROM care_responses cr
    JOIN care_requests crr ON cr.request_id = crr.id
    WHERE cr.id = p_care_response_id
    AND cr.status = 'pending';  -- Only accept pending responses

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Care response not found or not in pending status';
    END IF;

    RAISE NOTICE 'Found care response for request: %', v_care_response.request_id;
    RAISE NOTICE 'Requester: %, Responder: %', v_care_response.requester_id, v_care_response.responder_id;
    RAISE NOTICE 'Reciprocal date: % %-%',
        v_care_response.reciprocal_date,
        v_care_response.reciprocal_start_time,
        v_care_response.reciprocal_end_time;

    -- Update the care response status to accepted
    UPDATE care_responses
    SET
        status = 'accepted',
        updated_at = NOW()
    WHERE id = p_care_response_id;

    RAISE NOTICE 'Updated care response status to accepted';

    -- Create scheduled care for the responder (who will provide care)
    INSERT INTO scheduled_care (
        parent_id,
        group_id,
        care_date,
        start_time,
        end_time,
        care_type,
        status,
        notes,
        related_request_id
    ) VALUES (
        v_care_response.responder_id,
        v_care_response.group_id,
        v_care_response.requested_date,
        v_care_response.start_time,
        v_care_response.end_time,
        'provided',
        'confirmed',
        v_care_response.response_notes,
        v_care_response.request_id
    ) RETURNING id INTO v_original_scheduled_care_id;

    RAISE NOTICE 'Created scheduled care for responder: %', v_original_scheduled_care_id;

    -- Create scheduled care for the requester (who will receive reciprocal care)
    INSERT INTO scheduled_care (
        parent_id,
        group_id,
        care_date,
        start_time,
        end_time,
        care_type,
        status,
        notes,
        related_request_id
    ) VALUES (
        v_care_response.requester_id,
        v_care_response.group_id,
        v_care_response.reciprocal_date,
        v_care_response.reciprocal_start_time,
        v_care_response.reciprocal_end_time,
        'received',
        'confirmed',
        'Reciprocal care for: ' || COALESCE(v_care_response.response_notes, ''),
        v_care_response.request_id
    ) RETURNING id INTO v_reciprocal_scheduled_care_id;

    RAISE NOTICE 'Created reciprocal scheduled care for requester: %', v_reciprocal_scheduled_care_id;

    -- Add children to the scheduled care blocks
    -- Add requester's child to the original care block (responder provides care)
    INSERT INTO scheduled_care_children (
        scheduled_care_id,
        child_id,
        providing_parent_id,
        notes
    ) VALUES (
        v_original_scheduled_care_id,
        v_care_response.requester_child_id,
        v_care_response.responder_id,
        'Care provided by ' || v_care_response.responder_id
    );

    RAISE NOTICE 'Added requester child to original care block';

    -- Add responder's child to the reciprocal care block (requester provides care)
    INSERT INTO scheduled_care_children (
        scheduled_care_id,
        child_id,
        providing_parent_id,
        notes
    ) VALUES (
        v_reciprocal_scheduled_care_id,
        v_care_response.reciprocal_child_id,
        v_care_response.requester_id,
        'Reciprocal care provided by ' || v_care_response.requester_id
    );

    RAISE NOTICE 'Added responder child to reciprocal care block';

    -- Update the care request status to completed
    UPDATE care_requests
    SET
        status = 'completed',
        responder_id = v_care_response.responder_id,
        updated_at = NOW()
    WHERE id = v_care_response.request_id;

    RAISE NOTICE 'Updated care request status to completed';

    -- Reject any other pending responses for this request
    UPDATE care_responses
    SET
        status = 'declined',
        updated_at = NOW()
    WHERE request_id = v_care_response.request_id
    AND id != p_care_response_id
    AND status = 'pending';

    RAISE NOTICE 'Rejected other pending responses for this request';

    -- Send notification to the responder whose response was accepted
    INSERT INTO notifications (
        id,
        user_id,
        type,
        title,
        message,
        data,
        is_read,
        created_at
    )
    SELECT
        gen_random_uuid(),
        v_care_response.responder_id,
        'care_accepted',
        'Reciprocal Care Response Accepted',
        'Your reciprocal care response has been accepted and the calendar has been updated.',
        jsonb_build_object(
            'care_response_id', p_care_response_id,
            'care_request_id', v_care_response.request_id,
            'requester_id', v_care_response.requester_id,
            'requested_date', v_care_response.requested_date,
            'start_time', v_care_response.start_time,
            'end_time', v_care_response.end_time,
            'reciprocal_date', v_care_response.reciprocal_date,
            'reciprocal_start_time', v_care_response.reciprocal_start_time,
            'reciprocal_end_time', v_care_response.reciprocal_end_time
        ),
        false,
        NOW();

    RAISE NOTICE 'Sent acceptance notification to responder';

    -- Send notification to responders whose responses were declined
    INSERT INTO notifications (
        id,
        user_id,
        type,
        title,
        message,
        data,
        is_read,
        created_at
    )
    SELECT
        gen_random_uuid(),
        cr.responder_id,
        'care_declined',
        'Reciprocal Care Response Not Accepted',
        'Your reciprocal care response was not accepted. The requester may have accepted a different response.',
        jsonb_build_object(
            'care_response_id', cr.id,
            'care_request_id', cr.request_id,
            'requested_date', v_care_response.requested_date,
            'start_time', v_care_response.start_time,
            'end_time', v_care_response.end_time
        ),
        false,
        NOW()
    FROM care_responses cr
    WHERE cr.request_id = v_care_response.request_id
    AND cr.id != p_care_response_id
    AND cr.status = 'declined'
    AND cr.updated_at >= NOW() - INTERVAL '1 minute';  -- Only send to recently declined responses

    RAISE NOTICE 'Sent decline notifications to other responders';

    RAISE NOTICE 'Reciprocal care response accepted successfully!';
    RETURN TRUE;

EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'Failed to accept reciprocal care response: %', SQLERRM;
END;
$$;

-- Grant permissions for accept function
GRANT EXECUTE ON FUNCTION accept_reciprocal_care_response(UUID) TO authenticated;
