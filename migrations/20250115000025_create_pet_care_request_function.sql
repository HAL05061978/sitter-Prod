-- =====================================================
-- CREATE PET CARE REQUEST FUNCTION
-- =====================================================
-- This function creates a pet care request similar to child care requests
-- and sends notifications to group members

DROP FUNCTION IF EXISTS create_pet_care_request(UUID, UUID, DATE, TIME, TIME, UUID, DATE, TEXT);

CREATE OR REPLACE FUNCTION create_pet_care_request(
    requester_id UUID,
    group_id UUID,
    requested_date DATE,
    start_time TIME,
    end_time TIME,
    pet_id UUID,
    end_date DATE DEFAULT NULL,
    notes TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    care_request_id UUID;
    group_member RECORD;
    existing_response_count INTEGER;
    v_requester_name TEXT;
    v_group_name TEXT;
    v_pet_name TEXT;
BEGIN
    RAISE NOTICE '=== CREATING PET CARE REQUEST ===';
    RAISE NOTICE 'Requester ID: %', requester_id;
    RAISE NOTICE 'Group ID: %', group_id;
    RAISE NOTICE 'Requested Date: %', requested_date;
    RAISE NOTICE 'End Date: %', end_date;
    RAISE NOTICE 'Start Time: %', start_time;
    RAISE NOTICE 'End Time: %', end_time;
    RAISE NOTICE 'Pet ID: %', pet_id;

    -- Get requester name for notifications
    SELECT full_name INTO v_requester_name
    FROM profiles
    WHERE id = requester_id;

    -- Get group name for notifications
    SELECT name INTO v_group_name
    FROM groups
    WHERE id = group_id;

    -- Get pet name for notifications
    SELECT name INTO v_pet_name
    FROM pets
    WHERE id = pet_id;

    -- Set end_date to requested_date if not provided (single day request)
    IF end_date IS NULL THEN
        end_date := requested_date;
    END IF;

    -- Insert the pet care request
    -- IMPORTANT: Using 'reciprocal' type so it shows up in get_reciprocal_pet_care_requests
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
        is_reciprocal,
        action_type
    ) VALUES (
        group_id,
        requester_id,
        pet_id,
        requested_date,
        end_date,
        start_time,
        end_time,
        notes,
        'reciprocal',  -- Changed from 'open' to match child care pattern
        'pending',
        true,  -- Changed from false to match child care pattern
        'new'
    ) RETURNING id INTO care_request_id;

    RAISE NOTICE 'Created pet care request with ID: %', care_request_id;

    -- Create pending responses for all active group members (except the requester)
    FOR group_member IN
        SELECT DISTINCT gm.profile_id, p.full_name
        FROM group_members gm
        JOIN profiles p ON gm.profile_id = p.id
        WHERE gm.group_id = create_pet_care_request.group_id
        AND gm.status = 'active'
        AND gm.profile_id != requester_id
        -- Ensure we don't create duplicate responses
        AND NOT EXISTS (
            SELECT 1 FROM pet_care_responses pcr
            WHERE pcr.request_id = care_request_id
            AND pcr.responder_id = gm.profile_id
        )
    LOOP
        RAISE NOTICE 'Creating pet care response for group member: %', group_member.profile_id;

        -- Create pending response
        INSERT INTO pet_care_responses (
            request_id,
            responder_id,
            response_type,
            status,
            created_at
        ) VALUES (
            care_request_id,
            group_member.profile_id,
            'pending',
            'pending',
            NOW()
        );

        -- Create notification for this group member
        -- IMPORTANT: Using 'care_request' as the type (valid type from notifications table constraint)
        -- Note: Not specifying is_read/status - will use default value
        INSERT INTO notifications (
            user_id,
            type,
            title,
            message,
            data
        ) VALUES (
            group_member.profile_id,
            'care_request',  -- Valid notification type
            'New Pet Care Request',
            COALESCE(v_requester_name, 'A parent') || ' needs pet care for ' ||
            COALESCE(v_pet_name, 'their pet') || ' in ' || COALESCE(v_group_name, 'your group') ||
            ' on ' || requested_date::TEXT ||
            CASE WHEN end_date != requested_date
                THEN ' to ' || end_date::TEXT
                ELSE ''
            END ||
            ' from ' || start_time::TEXT || ' to ' || end_time::TEXT,
            jsonb_build_object(
                'request_id', care_request_id,
                'requester_id', requester_id,
                'group_id', group_id,
                'pet_id', pet_id,
                'requested_date', requested_date,
                'end_date', end_date,
                'start_time', start_time,
                'end_time', end_time,
                'care_type', 'pet'
            )
        );
    END LOOP;

    -- Verify the number of responses created
    SELECT COUNT(*) INTO existing_response_count
    FROM pet_care_responses
    WHERE request_id = care_request_id;

    RAISE NOTICE 'Total pet care responses created: %', existing_response_count;
    RAISE NOTICE '=== PET CARE REQUEST CREATION COMPLETE ===';

    RETURN care_request_id;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION create_pet_care_request(UUID, UUID, DATE, TIME, TIME, UUID, DATE, TEXT) TO authenticated;

-- Success message
DO $$
BEGIN
    RAISE NOTICE '✅ create_pet_care_request function created successfully!';
END $$;
