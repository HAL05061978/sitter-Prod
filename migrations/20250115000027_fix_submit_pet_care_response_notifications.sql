-- =====================================================
-- FIX submit_pet_care_response - CORRECT NOTIFICATION TYPE
-- =====================================================
-- This fixes the notification type from 'pet_care_response_submitted' (invalid)
-- to 'care_response' (valid type from notifications table constraint)
-- =====================================================

DROP FUNCTION IF EXISTS submit_pet_care_response(UUID, UUID, DATE, DATE, TIME, TIME, UUID, TEXT);

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
    existing_response_id UUID;
    v_requester_name TEXT;
    v_responder_name TEXT;
    v_pet_name TEXT;
    v_group_name TEXT;
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

    -- Get names for notification
    SELECT full_name INTO v_responder_name
    FROM profiles
    WHERE id = p_responding_parent_id;

    SELECT full_name INTO v_requester_name
    FROM profiles
    WHERE id = v_requester_id;

    SELECT name INTO v_group_name
    FROM groups
    WHERE id = v_group_id;

    SELECT p.name INTO v_pet_name
    FROM pet_care_requests pcr
    JOIN pets p ON pcr.pet_id = p.id
    WHERE pcr.id = p_care_request_id;

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
            reciprocal_end_date = p_reciprocal_end_date,
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
            reciprocal_end_date,
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
            p_reciprocal_end_date,
            p_reciprocal_start_time,
            p_reciprocal_end_time,
            p_reciprocal_pet_id,
            p_notes,
            'submitted',
            'pending'
        ) RETURNING id INTO v_response_id;

        RAISE NOTICE 'Created new response: %', v_response_id;
    END IF;

    -- CREATE NOTIFICATION for the requester
    -- IMPORTANT: Using 'care_response' (valid type) instead of 'pet_care_response_submitted' (invalid)
    -- Not specifying is_read/status - will use default value for schema compatibility
    INSERT INTO notifications (
        user_id,
        type,
        title,
        message,
        data
    ) VALUES (
        v_requester_id,
        'care_response',  -- FIXED: Valid notification type
        'Pet Care Response Received',
        COALESCE(v_responder_name, 'A parent') || ' has responded to your pet care request for ' ||
        COALESCE(v_pet_name, 'your pet') || ' in ' || COALESCE(v_group_name, 'your group') ||
        ' with available dates: ' || p_reciprocal_date::TEXT ||
        CASE WHEN p_reciprocal_end_date IS NOT NULL AND p_reciprocal_end_date != p_reciprocal_date
            THEN ' to ' || p_reciprocal_end_date::TEXT
            ELSE ''
        END,
        jsonb_build_object(
            'response_id', v_response_id,
            'request_id', p_care_request_id,
            'responder_id', p_responding_parent_id,
            'reciprocal_date', p_reciprocal_date,
            'reciprocal_end_date', p_reciprocal_end_date,
            'reciprocal_start_time', p_reciprocal_start_time,
            'reciprocal_end_time', p_reciprocal_end_time,
            'care_type', 'pet'
        )
    );

    RAISE NOTICE '✅ Created notification for requester: %', v_requester_id;
    RAISE NOTICE '=== PET CARE RESPONSE SUBMITTED SUCCESSFULLY ===';

    RETURN v_response_id;

EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'Failed to submit pet care response: %', SQLERRM;
END;
$$;

GRANT EXECUTE ON FUNCTION submit_pet_care_response TO authenticated;

-- Success message
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ Fixed submit_pet_care_response function';
    RAISE NOTICE '✅ Now uses CORRECT notification type: care_response';
    RAISE NOTICE '✅ Compatible with both notification schemas';
    RAISE NOTICE '✅ Creates notification for requester';
    RAISE NOTICE '✅ Supports multi-day pet care';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
END $$;
