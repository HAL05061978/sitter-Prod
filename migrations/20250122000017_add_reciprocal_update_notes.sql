-- =====================================================
-- ADD RECIPROCAL CARE UPDATE NOTES FUNCTION
-- =====================================================
-- Allow provider to update notes and propagate to receiver

CREATE OR REPLACE FUNCTION update_reciprocal_care_notes(
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
    v_care_date DATE;
    v_start_time TIME;
    v_end_time TIME;
    v_group_id UUID;
    v_parent_id UUID;
    v_updated_count INTEGER := 0;
BEGIN
    -- Get the care block details
    SELECT
        sc.related_request_id,
        sc.care_type,
        sc.care_date,
        sc.start_time,
        sc.end_time,
        sc.group_id,
        sc.parent_id
    INTO
        v_related_request_id,
        v_care_type,
        v_care_date,
        v_start_time,
        v_end_time,
        v_group_id,
        v_parent_id
    FROM scheduled_care sc
    WHERE sc.id = p_scheduled_care_id;

    -- Validate this is reciprocal care
    IF v_care_type NOT IN ('provided', 'needed', 'received') THEN
        RETURN QUERY SELECT FALSE, 'This function only works for reciprocal care blocks'::TEXT, 0;
        RETURN;
    END IF;

    -- Validate that the parent is the provider
    IF v_care_type != 'provided' THEN
        RETURN QUERY SELECT FALSE, 'Only the provider can update notes for reciprocal care'::TEXT, 0;
        RETURN;
    END IF;

    -- Validate that this is the parent's block
    IF v_parent_id != p_parent_id THEN
        RETURN QUERY SELECT FALSE, 'You can only update your own care blocks'::TEXT, 0;
        RETURN;
    END IF;

    -- Update the provider's block
    UPDATE scheduled_care
    SET
        notes = p_new_notes,
        updated_at = NOW()
    WHERE id = p_scheduled_care_id;

    v_updated_count := v_updated_count + 1;

    -- Strategy 1: Try to update via related_request_id
    IF v_related_request_id IS NOT NULL THEN
        UPDATE scheduled_care
        SET
            notes = p_new_notes,
            updated_at = NOW()
        WHERE related_request_id = v_related_request_id
        AND care_type IN ('needed', 'received')
        AND id != p_scheduled_care_id;

        GET DIAGNOSTICS v_updated_count = ROW_COUNT;
        v_updated_count := v_updated_count + 1;  -- Include the provider's block

        IF v_updated_count > 1 THEN
            -- Successfully updated receiver via related_request_id
            RETURN QUERY SELECT
                TRUE,
                format('Successfully updated notes for %s participants (provider and receiver)', v_updated_count)::TEXT,
                v_updated_count;
            RETURN;
        END IF;
    END IF;

    -- Strategy 2: Update by matching care details (fallback)
    -- Find the receiver's block by matching time/date/group
    UPDATE scheduled_care
    SET
        notes = p_new_notes,
        updated_at = NOW()
    WHERE care_date = v_care_date
    AND start_time = v_start_time
    AND end_time = v_end_time
    AND group_id = v_group_id
    AND care_type IN ('needed', 'received')
    AND parent_id != p_parent_id
    AND id != p_scheduled_care_id;

    GET DIAGNOSTICS v_updated_count = ROW_COUNT;
    v_updated_count := v_updated_count + 1;  -- Include the provider's block

    -- Return success
    RETURN QUERY SELECT
        TRUE,
        format('Successfully updated notes for %s participants', v_updated_count)::TEXT,
        v_updated_count;
END;
$$;

GRANT EXECUTE ON FUNCTION update_reciprocal_care_notes(UUID, UUID, TEXT) TO authenticated;

COMMENT ON FUNCTION update_reciprocal_care_notes IS 'Updates notes for a reciprocal care block and propagates changes to the receiving parent. Only the provider can update notes.';
