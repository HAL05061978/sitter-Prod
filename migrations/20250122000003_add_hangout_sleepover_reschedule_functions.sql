-- =====================================================
-- RESCHEDULE FUNCTIONS FOR HANGOUT AND SLEEPOVER
-- =====================================================
-- These functions handle rescheduling hangout/sleepover events
-- Only the host can reschedule (not invitees)

-- =====================================================
-- STEP 1: Create function to reschedule hangout/sleepover
-- =====================================================

CREATE OR REPLACE FUNCTION reschedule_hangout_sleepover(
    p_care_request_id UUID,
    p_requesting_parent_id UUID,  -- Must be the original host
    p_new_date DATE,
    p_new_start_time TIME,
    p_new_end_time TIME,
    p_new_end_date DATE DEFAULT NULL,  -- Only for sleepovers
    p_reschedule_reason TEXT DEFAULT 'Host rescheduled the event'
)
RETURNS TABLE(
    success BOOLEAN,
    message TEXT,
    updated_count INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_request RECORD;
    v_updated_blocks INTEGER := 0;
    v_request_type TEXT;
BEGIN
    -- Get the care request details
    SELECT *
    INTO v_request
    FROM care_requests
    WHERE id = p_care_request_id;

    IF NOT FOUND THEN
        RETURN QUERY SELECT FALSE, 'Care request not found'::TEXT, 0;
        RETURN;
    END IF;

    -- Verify this is a hangout or sleepover
    IF v_request.action_type NOT IN ('hangout_invitation', 'sleepover_invitation') THEN
        RETURN QUERY SELECT FALSE, 'This function only handles hangout and sleepover events'::TEXT, 0;
        RETURN;
    END IF;

    -- Verify the requesting parent is the original host
    IF v_request.requester_id != p_requesting_parent_id THEN
        RETURN QUERY SELECT FALSE, 'Only the host can reschedule this event'::TEXT, 0;
        RETURN;
    END IF;

    -- For hangouts, end_date should be NULL
    IF v_request.request_type = 'hangout' AND p_new_end_date IS NOT NULL THEN
        RETURN QUERY SELECT FALSE, 'Hangouts cannot have an end date (same-day events only)'::TEXT, 0;
        RETURN;
    END IF;

    -- For sleepovers, end_date is required
    IF v_request.request_type = 'sleepover' AND p_new_end_date IS NULL THEN
        RETURN QUERY SELECT FALSE, 'Sleepovers require an end date'::TEXT, 0;
        RETURN;
    END IF;

    -- Update the care request with new date/time
    UPDATE care_requests
    SET
        requested_date = p_new_date,
        start_time = p_new_start_time,
        end_time = p_new_end_time,
        end_date = p_new_end_date,
        notes = COALESCE(notes || E'\n\n', '') || 'Rescheduled: ' || p_reschedule_reason,
        updated_at = NOW()
    WHERE id = p_care_request_id;

    -- Update all scheduled_care blocks (host and all accepted attendees)
    UPDATE scheduled_care
    SET
        care_date = p_new_date,
        start_time = p_new_start_time,
        end_time = p_new_end_time,
        end_date = p_new_end_date,
        notes = COALESCE(notes || E'\n\n', '') || 'Rescheduled by host: ' || p_reschedule_reason,
        updated_at = NOW()
    WHERE original_request_id = p_care_request_id;

    GET DIAGNOSTICS v_updated_blocks = ROW_COUNT;

    -- Update all care_responses to indicate the event was rescheduled
    UPDATE care_responses
    SET
        response_notes = COALESCE(response_notes || E'\n\n', '') || 'Event rescheduled by host: ' || p_reschedule_reason,
        updated_at = NOW()
    WHERE care_request_id = p_care_request_id;

    -- Return success
    RETURN QUERY SELECT
        TRUE,
        format('Successfully rescheduled %s. Updated %s care blocks.', v_request.request_type, v_updated_blocks)::TEXT,
        v_updated_blocks;

EXCEPTION
    WHEN OTHERS THEN
        RETURN QUERY SELECT FALSE, ('Error rescheduling event: ' || SQLERRM)::TEXT, 0;
END;
$$;

-- =====================================================
-- STEP 2: Create function to cancel hangout/sleepover
-- =====================================================

CREATE OR REPLACE FUNCTION cancel_hangout_sleepover(
    p_care_request_id UUID,
    p_requesting_parent_id UUID,  -- Must be the original host
    p_cancellation_reason TEXT DEFAULT 'Event cancelled by host'
)
RETURNS TABLE(
    success BOOLEAN,
    message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_request RECORD;
    v_deleted_blocks INTEGER := 0;
BEGIN
    -- Get the care request details
    SELECT *
    INTO v_request
    FROM care_requests
    WHERE id = p_care_request_id;

    IF NOT FOUND THEN
        RETURN QUERY SELECT FALSE, 'Care request not found'::TEXT;
        RETURN;
    END IF;

    -- Verify this is a hangout or sleepover
    IF v_request.action_type NOT IN ('hangout_invitation', 'sleepover_invitation') THEN
        RETURN QUERY SELECT FALSE, 'This function only handles hangout and sleepover events'::TEXT;
        RETURN;
    END IF;

    -- Verify the requesting parent is the original host
    IF v_request.requester_id != p_requesting_parent_id THEN
        RETURN QUERY SELECT FALSE, 'Only the host can cancel this event'::TEXT;
        RETURN;
    END IF;

    -- Update the care request to cancelled
    UPDATE care_requests
    SET
        status = 'cancelled',
        notes = COALESCE(notes || E'\n\n', '') || 'Cancelled: ' || p_cancellation_reason,
        updated_at = NOW()
    WHERE id = p_care_request_id;

    -- Update all care_responses to cancelled
    UPDATE care_responses
    SET
        response_status = 'cancelled',
        response_notes = COALESCE(response_notes || E'\n\n', '') || 'Event cancelled by host: ' || p_cancellation_reason,
        updated_at = NOW()
    WHERE care_request_id = p_care_request_id;

    -- Delete all scheduled_care blocks for this event
    DELETE FROM scheduled_care
    WHERE original_request_id = p_care_request_id;

    GET DIAGNOSTICS v_deleted_blocks = ROW_COUNT;

    -- Return success
    RETURN QUERY SELECT
        TRUE,
        format('Successfully cancelled %s. Removed %s care blocks.', v_request.request_type, v_deleted_blocks)::TEXT;

EXCEPTION
    WHEN OTHERS THEN
        RETURN QUERY SELECT FALSE, ('Error cancelling event: ' || SQLERRM)::TEXT;
END;
$$;

-- =====================================================
-- STEP 3: Grant permissions
-- =====================================================

GRANT EXECUTE ON FUNCTION reschedule_hangout_sleepover(UUID, UUID, DATE, TIME, TIME, DATE, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION cancel_hangout_sleepover(UUID, UUID, TEXT) TO authenticated;

-- =====================================================
-- STEP 4: Add comments
-- =====================================================

COMMENT ON FUNCTION reschedule_hangout_sleepover IS 'Reschedules a hangout or sleepover event. Only the host can reschedule.';
COMMENT ON FUNCTION cancel_hangout_sleepover IS 'Cancels a hangout or sleepover event. Only the host can cancel.';
