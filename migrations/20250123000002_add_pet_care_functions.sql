-- =====================================================
-- PET CARE WORKFLOW FUNCTIONS
-- =====================================================
-- Functions for pet care reciprocal workflow
-- Mirrors child care reciprocal workflow but for pets
-- =====================================================

-- =====================================================
-- FUNCTION 1: send_pet_care_request
-- =====================================================
DROP FUNCTION IF EXISTS send_pet_care_request(UUID, UUID, UUID, DATE, DATE, TIME, TIME, UUID, UUID, DATE, TIME, TIME, UUID, TEXT);

CREATE OR REPLACE FUNCTION send_pet_care_request(
    p_requester_id UUID,
    p_group_id UUID,
    p_pet_id UUID,
    p_requested_date DATE,
    p_requested_end_date DATE,  -- For multi-day pet care
    p_start_time TIME,
    p_end_time TIME,
    p_responder_id UUID,
    p_reciprocal_pet_id UUID,
    p_reciprocal_date DATE,
    p_reciprocal_start_time TIME,
    p_reciprocal_end_time TIME,
    p_reciprocal_end_date DATE DEFAULT NULL,  -- For multi-day reciprocal
    p_notes TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_request_id UUID;
    v_response_id UUID;
BEGIN
    RAISE NOTICE '=== SENDING PET CARE REQUEST ===';
    RAISE NOTICE 'Requester: %, Responder: %', p_requester_id, p_responder_id;
    RAISE NOTICE 'Requested Date: % to %', p_requested_date, p_requested_end_date;
    RAISE NOTICE 'Reciprocal Date: % to %', p_reciprocal_date, p_reciprocal_end_date;

    -- Validate that both users are in the same group
    IF NOT EXISTS (
        SELECT 1 FROM group_members
        WHERE group_id = p_group_id
        AND profile_id = p_requester_id
        AND status = 'active'
    ) THEN
        RAISE EXCEPTION 'Requester is not a member of this group';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM group_members
        WHERE group_id = p_group_id
        AND profile_id = p_responder_id
        AND status = 'active'
    ) THEN
        RAISE EXCEPTION 'Responder is not a member of this group';
    END IF;

    -- Calculate end date if not provided (default to same day)
    IF p_requested_end_date IS NULL THEN
        p_requested_end_date := p_requested_date;
    END IF;

    IF p_reciprocal_end_date IS NULL THEN
        p_reciprocal_end_date := p_reciprocal_date;
    END IF;

    -- Create the pet care request
    INSERT INTO pet_care_requests (
        group_id,
        requester_id,
        pet_id,
        requested_date,
        end_date,
        start_time,
        end_time,
        notes,
        request_type,
        status,
        responder_id,
        is_reciprocal,
        reciprocal_parent_id,
        reciprocal_pet_id,
        reciprocal_date,
        reciprocal_start_time,
        reciprocal_end_time,
        reciprocal_status,
        action_type
    ) VALUES (
        p_group_id,
        p_requester_id,
        p_pet_id,
        p_requested_date,
        p_requested_end_date,
        p_start_time,
        p_end_time,
        p_notes,
        'reciprocal',
        'pending',
        p_responder_id,
        true,
        p_responder_id,
        p_reciprocal_pet_id,
        p_reciprocal_date,
        p_reciprocal_start_time,
        p_reciprocal_end_time,
        'pending',
        'new'
    ) RETURNING id INTO v_request_id;

    RAISE NOTICE 'Created pet care request: %', v_request_id;

    -- Create a placeholder response for the responder
    INSERT INTO pet_care_responses (
        request_id,
        responder_id,
        response_type,
        status,
        reciprocal_date,
        reciprocal_start_time,
        reciprocal_end_time,
        reciprocal_pet_id,
        action_type
    ) VALUES (
        v_request_id,
        p_responder_id,
        'pending',
        'pending',
        p_reciprocal_date,
        p_reciprocal_start_time,
        p_reciprocal_end_time,
        p_reciprocal_pet_id,
        'new'
    ) RETURNING id INTO v_response_id;

    RAISE NOTICE 'Created placeholder response: %', v_response_id;

    RETURN v_request_id;

EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'Failed to send pet care request: %', SQLERRM;
END;
$$;

GRANT EXECUTE ON FUNCTION send_pet_care_request TO authenticated;

-- =====================================================
-- FUNCTION 2: submit_pet_care_response
-- =====================================================
DROP FUNCTION IF EXISTS submit_pet_care_response(UUID, UUID, DATE, DATE, TIME, TIME, UUID, TEXT);

CREATE OR REPLACE FUNCTION submit_pet_care_response(
    p_care_request_id UUID,
    p_responding_parent_id UUID,
    p_reciprocal_date DATE,
    p_reciprocal_end_date DATE,  -- For multi-day
    p_reciprocal_start_time TIME,
    p_reciprocal_end_time TIME,
    p_reciprocal_pet_id UUID,
    p_notes TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_response_id UUID;
    v_group_id UUID;
    v_requester_id UUID;
    existing_response_id UUID;
BEGIN
    RAISE NOTICE '=== SUBMITTING PET CARE RESPONSE ===';
    RAISE NOTICE 'Care Request ID: %', p_care_request_id;
    RAISE NOTICE 'Responding Parent ID: %', p_responding_parent_id;
    RAISE NOTICE 'Reciprocal Date: % to %', p_reciprocal_date, p_reciprocal_end_date;

    -- Get the care request details
    SELECT group_id, requester_id INTO v_group_id, v_requester_id
    FROM pet_care_requests
    WHERE id = p_care_request_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Pet care request not found with ID: %', p_care_request_id;
    END IF;

    RAISE NOTICE 'Found care request - Group ID: %, Requester ID: %', v_group_id, v_requester_id;

    -- Validate that the responding parent is in the same group
    IF NOT EXISTS (
        SELECT 1 FROM group_members
        WHERE group_id = v_group_id
        AND profile_id = p_responding_parent_id
        AND status = 'active'
    ) THEN
        RAISE EXCEPTION 'Responding parent is not a member of this group';
    END IF;

    -- Check if user already has a response (including placeholder)
    SELECT id INTO existing_response_id
    FROM pet_care_responses
    WHERE request_id = p_care_request_id
    AND responder_id = p_responding_parent_id;

    IF existing_response_id IS NOT NULL THEN
        RAISE NOTICE 'Found existing response: %, updating it', existing_response_id;

        -- Update the existing response with the reciprocal details
        UPDATE pet_care_responses SET
            reciprocal_date = p_reciprocal_date,
            reciprocal_start_time = p_reciprocal_start_time,
            reciprocal_end_time = p_reciprocal_end_time,
            reciprocal_pet_id = p_reciprocal_pet_id,
            response_notes = p_notes,
            status = 'submitted',  -- Mark as submitted for review
            response_type = 'pending',
            updated_at = NOW()
        WHERE id = existing_response_id;

        v_response_id := existing_response_id;
        RAISE NOTICE 'Updated existing response: %', v_response_id;

    ELSE
        RAISE NOTICE 'No existing response found, creating new one';

        -- Insert a new care response
        INSERT INTO pet_care_responses (
            request_id,
            responder_id,
            reciprocal_date,
            reciprocal_start_time,
            reciprocal_end_time,
            reciprocal_pet_id,
            response_notes,
            status,
            response_type
        ) VALUES (
            p_care_request_id,
            p_responding_parent_id,
            p_reciprocal_date,
            p_reciprocal_start_time,
            p_reciprocal_end_time,
            p_reciprocal_pet_id,
            p_notes,
            'submitted',
            'pending'
        ) RETURNING id INTO v_response_id;

        RAISE NOTICE 'Created new response: %', v_response_id;
    END IF;

    RETURN v_response_id;

EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'Failed to submit pet care response: %', SQLERRM;
END;
$$;

GRANT EXECUTE ON FUNCTION submit_pet_care_response TO authenticated;

-- =====================================================
-- FUNCTION 3: accept_pet_care_response
-- =====================================================
DROP FUNCTION IF EXISTS accept_pet_care_response(UUID);

CREATE OR REPLACE FUNCTION accept_pet_care_response(
    p_care_response_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_care_response RECORD;
    v_original_scheduled_care_id UUID;
    v_reciprocal_scheduled_care_id UUID;
BEGIN
    RAISE NOTICE '=== ACCEPTING PET CARE RESPONSE ===';
    RAISE NOTICE 'Care Response ID: %', p_care_response_id;

    -- Get the care response details
    SELECT
        cr.*,
        crr.requester_id,
        crr.group_id,
        crr.pet_id as requester_pet_id,
        crr.requested_date,
        crr.end_date as requested_end_date,
        crr.start_time,
        crr.end_time
    INTO v_care_response
    FROM pet_care_responses cr
    JOIN pet_care_requests crr ON cr.request_id = crr.id
    WHERE cr.id = p_care_response_id
    AND cr.status = 'submitted';

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Pet care response not found or not in submitted status. Response ID: %', p_care_response_id;
    END IF;

    RAISE NOTICE 'Found care response for request: %', v_care_response.request_id;
    RAISE NOTICE 'Requester: %, Responder: %', v_care_response.requester_id, v_care_response.responder_id;

    -- Update the care response status to accepted
    UPDATE pet_care_responses
    SET
        status = 'accepted',
        response_type = 'accepted',
        updated_at = NOW()
    WHERE id = p_care_response_id;

    RAISE NOTICE 'Updated care response status to accepted';

    -- Update the pet care request status to accepted
    UPDATE pet_care_requests
    SET
        status = 'accepted',
        updated_at = NOW()
    WHERE id = v_care_response.request_id;

    -- Create scheduled_pet_care for the responder (who will provide care for the original request)
    INSERT INTO scheduled_pet_care (
        parent_id,
        group_id,
        care_date,
        end_date,
        start_time,
        end_time,
        care_type,
        status,
        notes,
        related_request_id,
        pet_id
    ) VALUES (
        v_care_response.responder_id,
        v_care_response.group_id,
        v_care_response.requested_date,
        v_care_response.requested_end_date,
        v_care_response.start_time,
        v_care_response.end_time,
        'provided',
        'confirmed',
        COALESCE(v_care_response.response_notes, 'Original request pet care provided by responder'),
        v_care_response.request_id,
        v_care_response.requester_pet_id
    ) RETURNING id INTO v_original_scheduled_care_id;

    RAISE NOTICE 'Created scheduled pet care for responder (providing): %', v_original_scheduled_care_id;

    -- Add pet to the scheduled care block
    INSERT INTO scheduled_pet_care_pets (scheduled_pet_care_id, pet_id)
    VALUES (v_original_scheduled_care_id, v_care_response.requester_pet_id);

    -- Create scheduled_pet_care for the requester (who will need care during original time)
    INSERT INTO scheduled_pet_care (
        parent_id,
        group_id,
        care_date,
        end_date,
        start_time,
        end_time,
        care_type,
        status,
        notes,
        related_request_id,
        pet_id
    ) VALUES (
        v_care_response.requester_id,
        v_care_response.group_id,
        v_care_response.requested_date,
        v_care_response.requested_end_date,
        v_care_response.start_time,
        v_care_response.end_time,
        'needed',
        'confirmed',
        COALESCE(v_care_response.response_notes, 'Original request pet care for requester'),
        v_care_response.request_id,
        v_care_response.requester_pet_id
    ) RETURNING id INTO v_original_scheduled_care_id;

    RAISE NOTICE 'Created scheduled pet care for requester (needing - original time): %', v_original_scheduled_care_id;

    -- Add pet to the scheduled care block
    INSERT INTO scheduled_pet_care_pets (scheduled_pet_care_id, pet_id)
    VALUES (v_original_scheduled_care_id, v_care_response.requester_pet_id);

    -- Create scheduled_pet_care for the requester (who will provide reciprocal care)
    INSERT INTO scheduled_pet_care (
        parent_id,
        group_id,
        care_date,
        start_time,
        end_time,
        care_type,
        status,
        notes,
        related_request_id,
        pet_id
    ) VALUES (
        v_care_response.requester_id,
        v_care_response.group_id,
        v_care_response.reciprocal_date,
        v_care_response.reciprocal_start_time,
        v_care_response.reciprocal_end_time,
        'provided',
        'confirmed',
        'Reciprocal pet care provided by requester',
        v_care_response.request_id,
        v_care_response.reciprocal_pet_id
    ) RETURNING id INTO v_reciprocal_scheduled_care_id;

    RAISE NOTICE 'Created reciprocal scheduled pet care for requester (providing): %', v_reciprocal_scheduled_care_id;

    -- Add pet to the scheduled care block
    INSERT INTO scheduled_pet_care_pets (scheduled_pet_care_id, pet_id)
    VALUES (v_reciprocal_scheduled_care_id, v_care_response.reciprocal_pet_id);

    -- Create scheduled_pet_care for the responder (who will need care during reciprocal time)
    INSERT INTO scheduled_pet_care (
        parent_id,
        group_id,
        care_date,
        start_time,
        end_time,
        care_type,
        status,
        notes,
        related_request_id,
        pet_id
    ) VALUES (
        v_care_response.responder_id,
        v_care_response.group_id,
        v_care_response.reciprocal_date,
        v_care_response.reciprocal_start_time,
        v_care_response.reciprocal_end_time,
        'needed',
        'confirmed',
        'Reciprocal pet care for responder',
        v_care_response.request_id,
        v_care_response.reciprocal_pet_id
    ) RETURNING id INTO v_reciprocal_scheduled_care_id;

    RAISE NOTICE 'Created scheduled pet care for responder (needing - reciprocal time): %', v_reciprocal_scheduled_care_id;

    -- Add pet to the scheduled care block
    INSERT INTO scheduled_pet_care_pets (scheduled_pet_care_id, pet_id)
    VALUES (v_reciprocal_scheduled_care_id, v_care_response.reciprocal_pet_id);

    RAISE NOTICE 'Successfully created all 4 scheduled pet care blocks';

    RETURN TRUE;

EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'Failed to accept pet care response: %', SQLERRM;
END;
$$;

GRANT EXECUTE ON FUNCTION accept_pet_care_response TO authenticated;

-- =====================================================
-- FUNCTION 4: decline_pet_care_request
-- =====================================================
DROP FUNCTION IF EXISTS decline_pet_care_request(UUID, UUID, TEXT);

CREATE OR REPLACE FUNCTION decline_pet_care_request(
    p_request_id UUID,
    p_responder_id UUID,
    p_decline_reason TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_response_id UUID;
BEGIN
    RAISE NOTICE '=== DECLINING PET CARE REQUEST ===';
    RAISE NOTICE 'Request ID: %, Responder: %', p_request_id, p_responder_id;

    -- Validate that the responder has a response for this request
    SELECT id INTO v_response_id
    FROM pet_care_responses
    WHERE request_id = p_request_id
    AND responder_id = p_responder_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'No response found for this request and responder';
    END IF;

    -- Update the response status to declined
    UPDATE pet_care_responses
    SET
        status = 'declined',
        response_type = 'declined',
        response_notes = p_decline_reason,
        updated_at = NOW()
    WHERE id = v_response_id;

    -- Update the request status to declined
    UPDATE pet_care_requests
    SET
        status = 'declined',
        updated_at = NOW()
    WHERE id = p_request_id;

    RAISE NOTICE 'Successfully declined pet care request';

    RETURN TRUE;

EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'Failed to decline pet care request: %', SQLERRM;
END;
$$;

GRANT EXECUTE ON FUNCTION decline_pet_care_request TO authenticated;

-- =====================================================
-- FUNCTION 5: cancel_pet_care_block
-- =====================================================
DROP FUNCTION IF EXISTS cancel_pet_care_block(UUID, UUID, TEXT);

CREATE OR REPLACE FUNCTION cancel_pet_care_block(
    p_scheduled_care_id UUID,
    p_parent_id UUID,
    p_cancel_reason TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_related_request_id UUID;
    v_care_type VARCHAR(50);
BEGIN
    RAISE NOTICE '=== CANCELLING PET CARE BLOCK ===';
    RAISE NOTICE 'Scheduled Care ID: %, Parent: %', p_scheduled_care_id, p_parent_id;

    -- Get the scheduled care details
    SELECT related_request_id, care_type
    INTO v_related_request_id, v_care_type
    FROM scheduled_pet_care
    WHERE id = p_scheduled_care_id
    AND parent_id = p_parent_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Pet care block not found or you do not have permission to cancel it';
    END IF;

    -- Update the scheduled care status to cancelled
    UPDATE scheduled_pet_care
    SET
        status = 'cancelled',
        notes = COALESCE(notes || E'\n\n', '') || 'Cancelled: ' || COALESCE(p_cancel_reason, 'No reason provided'),
        updated_at = NOW()
    WHERE id = p_scheduled_care_id;

    -- If this is part of a reciprocal request, cancel all related blocks
    IF v_related_request_id IS NOT NULL THEN
        UPDATE scheduled_pet_care
        SET
            status = 'cancelled',
            notes = COALESCE(notes || E'\n\n', '') || 'Cancelled due to related block cancellation',
            updated_at = NOW()
        WHERE related_request_id = v_related_request_id
        AND status != 'cancelled';

        -- Update the request status
        UPDATE pet_care_requests
        SET
            status = 'cancelled',
            updated_at = NOW()
        WHERE id = v_related_request_id;

        -- Update all responses
        UPDATE pet_care_responses
        SET
            status = 'cancelled',
            updated_at = NOW()
        WHERE request_id = v_related_request_id
        AND status != 'cancelled';
    END IF;

    RAISE NOTICE 'Successfully cancelled pet care block and related items';

    RETURN TRUE;

EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'Failed to cancel pet care block: %', SQLERRM;
END;
$$;

GRANT EXECUTE ON FUNCTION cancel_pet_care_block TO authenticated;

-- =====================================================
-- FUNCTION 6: update_pet_care_notes
-- =====================================================
DROP FUNCTION IF EXISTS update_pet_care_notes(UUID, UUID, TEXT);

CREATE OR REPLACE FUNCTION update_pet_care_notes(
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
    FROM scheduled_pet_care sc
    WHERE sc.id = p_scheduled_care_id;

    -- Validate this is reciprocal pet care
    IF v_care_type NOT IN ('provided', 'needed', 'received') THEN
        RETURN QUERY SELECT FALSE, 'This function only works for reciprocal pet care blocks'::TEXT, 0;
        RETURN;
    END IF;

    -- Validate that the parent is the provider
    IF v_care_type != 'provided' THEN
        RETURN QUERY SELECT FALSE, 'Only the provider can update notes for reciprocal pet care'::TEXT, 0;
        RETURN;
    END IF;

    -- Validate that this is the parent's block
    IF v_parent_id != p_parent_id THEN
        RETURN QUERY SELECT FALSE, 'You can only update your own pet care blocks'::TEXT, 0;
        RETURN;
    END IF;

    -- Update the provider's block
    UPDATE scheduled_pet_care
    SET
        notes = p_new_notes,
        updated_at = NOW()
    WHERE id = p_scheduled_care_id;

    v_updated_count := v_updated_count + 1;

    -- Find and update the receiver's block (same time, same group, care_type = 'needed')
    UPDATE scheduled_pet_care
    SET
        notes = p_new_notes,
        updated_at = NOW()
    WHERE
        group_id = v_group_id
        AND care_date = v_care_date
        AND start_time = v_start_time
        AND end_time = v_end_time
        AND care_type = 'needed'
        AND related_request_id = v_related_request_id
        AND parent_id != p_parent_id;

    v_updated_count := v_updated_count + 1;

    RETURN QUERY SELECT TRUE, 'Notes updated successfully for both provider and receiver'::TEXT, v_updated_count;
END;
$$;

GRANT EXECUTE ON FUNCTION update_pet_care_notes TO authenticated;

-- =====================================================
-- VERIFICATION
-- =====================================================
SELECT
    routine_name,
    routine_type,
    data_type as return_type
FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_name LIKE 'send_pet_care%'
   OR routine_name LIKE 'submit_pet_care%'
   OR routine_name LIKE 'accept_pet_care%'
   OR routine_name LIKE 'decline_pet_care%'
   OR routine_name LIKE 'cancel_pet_care%'
   OR routine_name LIKE 'update_pet_care%';

-- Success message
DO $$
BEGIN
    RAISE NOTICE '✅ All pet care functions created successfully!';
    RAISE NOTICE '✅ send_pet_care_request';
    RAISE NOTICE '✅ submit_pet_care_response';
    RAISE NOTICE '✅ accept_pet_care_response';
    RAISE NOTICE '✅ decline_pet_care_request';
    RAISE NOTICE '✅ cancel_pet_care_block';
    RAISE NOTICE '✅ update_pet_care_notes';
END $$;
