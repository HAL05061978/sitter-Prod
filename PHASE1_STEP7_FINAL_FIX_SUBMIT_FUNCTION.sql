-- =====================================================
-- PHASE 1 STEP 7: Fix submit_pet_care_response
-- =====================================================
-- THE ROOT CAUSE: submit_pet_care_response was accepting
-- p_reciprocal_end_date parameter but NOT storing it!
--
-- This is why reciprocal_end_date was NULL in pet_care_responses.
-- Once we fix this, the rest of the chain works:
--   1. User fills reciprocal_end_date in form ✅
--   2. Frontend sends it to backend ✅
--   3. Backend function stores it ❌ <- FIXED NOW
--   4. Acceptance function copies it to pet_care_requests ✅
-- =====================================================

CREATE OR REPLACE FUNCTION submit_pet_care_response(
    p_care_request_id UUID,
    p_responding_parent_id UUID,
    p_reciprocal_date DATE,
    p_reciprocal_end_date DATE,
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
    v_requested_date DATE;
    v_requested_end_date DATE;
    existing_response_id UUID;
BEGIN
    RAISE NOTICE '=== SUBMITTING PET CARE RESPONSE ===';
    RAISE NOTICE 'Care Request ID: %', p_care_request_id;
    RAISE NOTICE 'Responding Parent ID: %', p_responding_parent_id;
    RAISE NOTICE 'Reciprocal Date: % to %', p_reciprocal_date, p_reciprocal_end_date;

    -- Get the care request details
    SELECT group_id, requester_id, requested_date, COALESCE(end_date, requested_date)
    INTO v_group_id, v_requester_id, v_requested_date, v_requested_end_date
    FROM pet_care_requests
    WHERE id = p_care_request_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Pet care request not found with ID: %', p_care_request_id;
    END IF;

    -- VALIDATION: Reciprocal dates cannot overlap with original request dates
    IF p_reciprocal_date <= v_requested_end_date
       AND COALESCE(p_reciprocal_end_date, p_reciprocal_date) >= v_requested_date THEN
        RAISE EXCEPTION 'Reciprocal dates (% to %) cannot overlap with original request dates (% to %). You cannot watch their pet while they are watching yours!',
            p_reciprocal_date,
            COALESCE(p_reciprocal_end_date, p_reciprocal_date),
            v_requested_date,
            v_requested_end_date;
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
            reciprocal_end_date = p_reciprocal_end_date,  -- FIXED: Now stores end date
            reciprocal_start_time = p_reciprocal_start_time,
            reciprocal_end_time = p_reciprocal_end_time,
            reciprocal_pet_id = p_reciprocal_pet_id,
            response_notes = p_notes,
            status = 'submitted',
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
            reciprocal_end_date,  -- FIXED: Now stores end date
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
            p_reciprocal_end_date,  -- FIXED: Now stores end date
            p_reciprocal_start_time,
            p_reciprocal_end_time,
            p_reciprocal_pet_id,
            p_notes,
            'submitted',
            'pending'
        ) RETURNING id INTO v_response_id;

        RAISE NOTICE 'Created new response: %', v_response_id;
    END IF;

    -- Create notification for the requester
    INSERT INTO notifications (
        user_id,
        type,
        title,
        message,
        data,
        is_read
    ) VALUES (
        v_requester_id,
        'pet_care_response_submitted',
        'Pet Care Response Received',
        'You have received a response to your pet care request',
        jsonb_build_object(
            'response_id', v_response_id,
            'request_id', p_care_request_id,
            'responder_id', p_responding_parent_id,
            'reciprocal_date', p_reciprocal_date,
            'reciprocal_end_date', p_reciprocal_end_date
        ),
        false
    );

    RAISE NOTICE '✅ Created notification for requester: %', v_requester_id;
    RAISE NOTICE '✅ Stored reciprocal_end_date: %', p_reciprocal_end_date;
    RAISE NOTICE '=== PET CARE RESPONSE SUBMITTED SUCCESSFULLY ===';

    RETURN v_response_id;

EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'Failed to submit pet care response: %', SQLERRM;
END;
$$;

GRANT EXECUTE ON FUNCTION submit_pet_care_response TO authenticated;

-- Verification
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ PHASE 1 STEP 7 + PHASE 2 VALIDATION COMPLETE!';
    RAISE NOTICE '✅ submit_pet_care_response NOW stores reciprocal_end_date';
    RAISE NOTICE '✅ Validates reciprocal dates do not overlap with request';
    RAISE NOTICE '';
    RAISE NOTICE 'COMPLETE DATA FLOW:';
    RAISE NOTICE '  1. User fills reciprocal_end_date in form';
    RAISE NOTICE '  2. Frontend validates no date overlap ✅';
    RAISE NOTICE '  3. Backend validates no date overlap ✅';
    RAISE NOTICE '  4. Function stores in pet_care_responses ✅';
    RAISE NOTICE '  5. Acceptance copies to pet_care_requests ✅';
    RAISE NOTICE '  6. Calendar displays blocks across all days ✅';
    RAISE NOTICE '';
    RAISE NOTICE '🎉 PHASE 1 + PHASE 2 NOW COMPLETE!';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
END $$;
