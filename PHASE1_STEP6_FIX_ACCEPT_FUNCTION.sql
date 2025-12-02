-- =====================================================
-- PHASE 1 STEP 6: Fix accept_pet_care_response
-- =====================================================
-- Update the acceptance function to:
-- 1. Populate reciprocal fields in pet_care_requests
-- 2. Add end_date support for reciprocal blocks
--
-- This completes Phase 1 by ensuring accepted responses
-- properly store the agreed reciprocal details
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
    AND cr.status = 'submitted';  -- Must be submitted status

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Pet care response not found or not in submitted status. Response ID: %', p_care_response_id;
    END IF;

    RAISE NOTICE 'Found care response for request: %', v_care_response.request_id;
    RAISE NOTICE 'Requester: %, Responder: %', v_care_response.requester_id, v_care_response.responder_id;
    RAISE NOTICE 'Reciprocal: % to % (pet: %)', v_care_response.reciprocal_date, v_care_response.reciprocal_end_date, v_care_response.reciprocal_pet_id;

    -- Update the care response status to accepted
    UPDATE pet_care_responses
    SET
        status = 'accepted',
        response_type = 'accepted',
        updated_at = NOW()
    WHERE id = p_care_response_id;

    RAISE NOTICE 'Updated care response status to accepted';

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
    -- NEW: Now includes end_date for multi-day reciprocal blocks
    INSERT INTO scheduled_pet_care (
        parent_id,
        group_id,
        care_date,
        end_date,  -- NEW: Multi-day support
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
        v_care_response.reciprocal_end_date,  -- NEW: Multi-day support
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
    -- NEW: Now includes end_date for multi-day reciprocal blocks
    INSERT INTO scheduled_pet_care (
        parent_id,
        group_id,
        care_date,
        end_date,  -- NEW: Multi-day support
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
        v_care_response.reciprocal_end_date,  -- NEW: Multi-day support
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

    RAISE NOTICE 'Successfully created all 4 scheduled pet care blocks (with multi-day support)';

    -- IMPORTANT: Decline ALL other responses FIRST (both pending and submitted), before updating pet_care_requests
    UPDATE pet_care_responses
    SET
        status = 'declined',
        updated_at = NOW()
    WHERE request_id = v_care_response.request_id
    AND id != p_care_response_id
    AND status IN ('pending', 'submitted');

    RAISE NOTICE 'Rejected all other pending/submitted responses for this request';

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
        'Pet Care Response Accepted',
        'Your reciprocal pet care response has been accepted and the calendar has been updated.',
        jsonb_build_object(
            'care_response_id', p_care_response_id,
            'care_request_id', v_care_response.request_id,
            'requester_id', v_care_response.requester_id,
            'requested_date', v_care_response.requested_date,
            'start_time', v_care_response.start_time,
            'end_time', v_care_response.end_time,
            'reciprocal_date', v_care_response.reciprocal_date,
            'reciprocal_start_time', v_care_response.reciprocal_start_time,
            'reciprocal_end_time', v_care_response.reciprocal_end_time,
            'care_type', 'pet'
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
        pcr.responder_id,
        'care_declined',
        'Your reciprocal pet care response for ' || TO_CHAR(pcrq.requested_date, 'Mon DD, YYYY') || ' was not accepted',
        'The requester may have accepted a different response.',
        jsonb_build_object(
            'care_response_id', pcr.id,
            'care_request_id', pcr.request_id,
            'requested_date', pcrq.requested_date,
            'start_time', pcrq.start_time,
            'end_time', pcrq.end_time,
            'care_type', 'pet'
        ),
        false,
        NOW()
    FROM pet_care_responses pcr
    JOIN pet_care_requests pcrq ON pcr.request_id = pcrq.id
    WHERE pcr.request_id = v_care_response.request_id
    AND pcr.id != p_care_response_id
    AND pcr.status = 'declined'
    AND pcr.updated_at >= NOW() - INTERVAL '1 minute';  -- Only send to recently declined responses

    RAISE NOTICE 'Sent decline notifications to other responders';

    -- NOW update the pet care request with accepted response details
    -- NEW: Populate ALL reciprocal fields so they're stored in the request
    UPDATE pet_care_requests
    SET
        status = 'accepted',
        responder_id = v_care_response.responder_id,
        reciprocal_parent_id = v_care_response.responder_id,
        reciprocal_pet_id = v_care_response.reciprocal_pet_id,  -- NEW: Store reciprocal pet
        reciprocal_date = v_care_response.reciprocal_date,  -- NEW: Store reciprocal date
        reciprocal_end_date = v_care_response.reciprocal_end_date,  -- NEW: Store reciprocal end date
        reciprocal_start_time = v_care_response.reciprocal_start_time,  -- NEW: Store reciprocal times
        reciprocal_end_time = v_care_response.reciprocal_end_time,  -- NEW: Store reciprocal times
        updated_at = NOW()
    WHERE id = v_care_response.request_id;

    RAISE NOTICE 'Updated pet care request with full reciprocal details';
    RAISE NOTICE 'Pet care response accepted successfully!';

    RETURN TRUE;

EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Error in accept_pet_care_response: %', SQLERRM;
        RAISE EXCEPTION 'Failed to accept pet care response: %', SQLERRM;
END;
$$;

GRANT EXECUTE ON FUNCTION accept_pet_care_response TO authenticated;

-- =====================================================
-- VERIFICATION
-- =====================================================
DO $$
BEGIN
    RAISE NOTICE '✅ accept_pet_care_response function updated successfully!';
    RAISE NOTICE '✅ Now populates ALL reciprocal fields in pet_care_requests';
    RAISE NOTICE '✅ Multi-day reciprocal blocks now include end_date';
    RAISE NOTICE '✅ Stores: reciprocal_pet_id, reciprocal_date, reciprocal_end_date, reciprocal_start_time, reciprocal_end_time';
    RAISE NOTICE '';
    RAISE NOTICE '🎉 PHASE 1 COMPLETE - Database fully supports multi-day pet care!';
END $$;
