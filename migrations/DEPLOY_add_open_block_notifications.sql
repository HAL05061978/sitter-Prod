-- =====================================================
-- ADD NOTIFICATIONS TO OPEN BLOCK ACCEPTANCE
-- =====================================================
-- This adds notifications when open blocks are accepted
-- SAFE: Only adds notifications AFTER all scheduling is complete
-- DOES NOT CHANGE: Any scheduling logic
--
-- INSTRUCTIONS:
-- 1. Open Supabase Dashboard > SQL Editor
-- 2. Click "New Query"
-- 3. Copy lines 443-520 from this file (just the notification section)
-- 4. Paste AFTER line 443 in the existing function
-- OR run this entire file to replace the whole function
-- =====================================================

-- NOTE: The easiest way is to add just the notification code.
-- Here's what to add RIGHT BEFORE "RETURN TRUE;" (line 444):

/*
    -- =====================================================
    -- NEW: Send notifications for open block acceptance
    -- =====================================================

    RAISE NOTICE '=== SENDING NOTIFICATIONS ===';

    -- Send notification to the open block provider (requester)
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
        v_care_request.requester_id,
        'open_block_accepted',
        'Open Block Accepted',
        (SELECT full_name FROM profiles WHERE id = p_accepting_parent_id) ||
        ' has accepted your open block for ' ||
        to_char(v_existing_block_date, 'Mon DD, YYYY') ||
        ' from ' || v_existing_block_start_time::TEXT ||
        ' to ' || v_existing_block_end_time::TEXT,
        jsonb_build_object(
            'care_response_id', p_care_response_id,
            'care_request_id', v_care_request_id,
            'accepting_parent_id', p_accepting_parent_id,
            'accepting_child_id', p_accepted_child_id,
            'opened_block_date', v_existing_block_date,
            'opened_block_start_time', v_existing_block_start_time,
            'opened_block_end_time', v_existing_block_end_time,
            'reciprocal_date', v_reciprocal_date,
            'reciprocal_start_time', v_reciprocal_start_time,
            'reciprocal_end_time', v_reciprocal_end_time,
            'group_id', v_care_request.group_id
        ),
        false,
        NOW();

    RAISE NOTICE 'Sent notification to open block provider (requester): %', v_care_request.requester_id;

    -- Send notification to the accepting parent
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
        p_accepting_parent_id,
        'open_block_accepted',
        'Open Block Accepted',
        'You accepted ' ||
        (SELECT full_name FROM profiles WHERE id = v_care_request.requester_id) ||
        '''s open block for ' ||
        to_char(v_existing_block_date, 'Mon DD, YYYY') ||
        ' from ' || v_existing_block_start_time::TEXT ||
        ' to ' || v_existing_block_end_time::TEXT ||
        '. Care blocks have been added to your calendar.',
        jsonb_build_object(
            'care_response_id', p_care_response_id,
            'care_request_id', v_care_request_id,
            'provider_parent_id', v_care_request.requester_id,
            'accepted_child_id', p_accepted_child_id,
            'opened_block_date', v_existing_block_date,
            'opened_block_start_time', v_existing_block_start_time,
            'opened_block_end_time', v_existing_block_end_time,
            'reciprocal_date', v_reciprocal_date,
            'reciprocal_start_time', v_reciprocal_start_time,
            'reciprocal_end_time', v_reciprocal_end_time,
            'group_id', v_care_request.group_id
        ),
        false,
        NOW();

    RAISE NOTICE 'Sent notification to accepting parent: %', p_accepting_parent_id;

    RAISE NOTICE '=== NOTIFICATIONS SENT SUCCESSFULLY ===';
*/

-- =====================================================
-- TO RESTORE ORIGINAL (if something goes wrong):
-- Run: supabase/supabase/migrations/20251024104700_fix_open_block_complete_v7.sql
-- =====================================================
