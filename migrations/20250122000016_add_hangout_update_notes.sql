-- =====================================================
-- ADD HANGOUT/SLEEPOVER UPDATE NOTES FUNCTION
-- =====================================================
-- Allow host to update notes and propagate to all attending parents

CREATE OR REPLACE FUNCTION update_hangout_sleepover_notes(
    p_scheduled_care_id UUID,
    p_parent_id UUID,
    p_new_notes TEXT
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
    v_related_request_id UUID;
    v_care_type TEXT;
    v_requester_id UUID;
    v_updated_count INTEGER := 0;
BEGIN
    -- Get the care block details
    SELECT
        sc.related_request_id,
        sc.care_type,
        cr.requester_id
    INTO
        v_related_request_id,
        v_care_type,
        v_requester_id
    FROM scheduled_care sc
    LEFT JOIN care_requests cr ON sc.related_request_id = cr.id
    WHERE sc.id = p_scheduled_care_id;

    -- Validate this is a hangout or sleepover
    IF v_care_type NOT IN ('hangout', 'sleepover') THEN
        RETURN QUERY SELECT FALSE, 'This function only works for hangout/sleepover blocks'::TEXT, 0;
        RETURN;
    END IF;

    -- Validate that the parent is the host (requester)
    IF v_requester_id IS NULL OR v_requester_id != p_parent_id THEN
        RETURN QUERY SELECT FALSE, 'Only the host can update notes for this event'::TEXT, 0;
        RETURN;
    END IF;

    -- Update the host's block
    UPDATE scheduled_care
    SET
        notes = p_new_notes,
        updated_at = NOW()
    WHERE id = p_scheduled_care_id;

    v_updated_count := v_updated_count + 1;

    -- Update all attending parents' blocks with the same notes
    UPDATE scheduled_care
    SET
        notes = p_new_notes,
        updated_at = NOW()
    WHERE related_request_id = v_related_request_id
    AND care_type = v_care_type
    AND id != p_scheduled_care_id;  -- Don't update the host's block again

    GET DIAGNOSTICS v_updated_count = ROW_COUNT;
    v_updated_count := v_updated_count + 1;  -- Include the host's block

    -- Return success
    RETURN QUERY SELECT
        TRUE,
        format('Successfully updated notes for %s participants', v_updated_count)::TEXT,
        v_updated_count;
END;
$$;

GRANT EXECUTE ON FUNCTION update_hangout_sleepover_notes(UUID, UUID, TEXT) TO authenticated;

COMMENT ON FUNCTION update_hangout_sleepover_notes IS 'Updates notes for a hangout/sleepover block and propagates changes to all attending parents. Only the host (original requester) can update notes.';
