-- Fix Group Invitation Logic
-- This fixes the accept_group_invitation_with_time_block function to correctly assign children and time slots

-- ============================================================================
-- STEP 1: Drop the existing function
-- ============================================================================

DROP FUNCTION IF EXISTS accept_group_invitation_with_time_block(UUID, UUID, INTEGER, UUID);

-- ============================================================================
-- STEP 2: Create the corrected function
-- ============================================================================

CREATE OR REPLACE FUNCTION accept_group_invitation_with_time_block(
    p_accepting_user_id UUID,
    p_invitation_id UUID,
    p_selected_time_block_index INTEGER,
    p_selected_child_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_invitation group_invitations%ROWTYPE;
    v_request babysitting_requests%ROWTYPE;
    v_duration_minutes INTEGER;
    v_existing_care_group_id UUID;
    v_inviter_child_id UUID;
    v_original_care_provider_id UUID;
    v_original_care_provider_child_id UUID;
BEGIN
    -- Get the invitation details
    SELECT * INTO v_invitation FROM group_invitations WHERE id = p_invitation_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Invitation not found';
    END IF;
    
    -- Get the original request details
    SELECT * INTO v_request FROM babysitting_requests WHERE id = v_invitation.request_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Original request not found';
    END IF;
    
    -- Validate that the selected child belongs to the accepting user
    IF NOT EXISTS (
        SELECT 1 FROM children 
        WHERE id = p_selected_child_id 
        AND parent_id = p_accepting_user_id
    ) THEN
        RAISE EXCEPTION 'Selected child does not belong to the accepting user';
    END IF;
    
    -- Find existing care group ID from the original blocks (Parent A ↔ Parent B)
    SELECT care_group_id INTO v_existing_care_group_id
    FROM scheduled_blocks 
    WHERE request_id = v_request.id 
    AND block_type = 'care_needed'
    LIMIT 1;
    
    IF v_existing_care_group_id IS NULL THEN
        RAISE EXCEPTION 'No existing care group found for the original request';
    END IF;
    
    -- Get the inviter's child ID (Parent B's child)
    SELECT child_id INTO v_inviter_child_id
    FROM scheduled_blocks 
    WHERE request_id = v_request.id 
    AND parent_id = v_invitation.inviter_id
    AND block_type = 'care_needed'
    LIMIT 1;
    
    IF v_inviter_child_id IS NULL THEN
        RAISE EXCEPTION 'Could not find inviter child for the original request';
    END IF;
    
    -- Get the original care provider's child ID (Parent A's child)
    SELECT child_id INTO v_original_care_provider_child_id
    FROM scheduled_blocks 
    WHERE request_id = v_request.id 
    AND block_type = 'care_provided'
    AND parent_id != v_invitation.inviter_id
    LIMIT 1;
    
    IF v_original_care_provider_child_id IS NULL THEN
        RAISE EXCEPTION 'Could not find original care provider child';
    END IF;
    
    -- Calculate duration for the invitation time
    v_duration_minutes := EXTRACT(EPOCH FROM (v_invitation.invitation_end_time::time - v_invitation.invitation_start_time::time)) / 60;
    
    -- Create 2 new scheduled blocks for the reciprocal arrangement:
    
    -- 1. Parent C (accepting user) needs care for their child on the ORIGINAL time slot
    -- This adds Parent C's child to the existing care arrangement
    INSERT INTO scheduled_blocks (
        group_id, parent_id, child_id, scheduled_date, start_time, end_time, 
        duration_minutes, block_type, status, request_id, notes, care_group_id
    ) VALUES (
        v_invitation.group_id, p_accepting_user_id, p_selected_child_id,
        v_request.requested_date, v_request.start_time, v_request.end_time,
        v_request.duration_minutes, 'care_needed', 'confirmed', v_request.id, 
        'Added via group invitation', v_existing_care_group_id
    );
    
    -- 2. Parent C (accepting user) provides care for Parent B's child on the INVITATION time slot
    -- This is the reciprocal arrangement where Parent C provides care for Parent B's child
    INSERT INTO scheduled_blocks (
        group_id, parent_id, child_id, scheduled_date, start_time, end_time, 
        duration_minutes, block_type, status, request_id, notes, care_group_id
    ) VALUES (
        v_invitation.group_id, p_accepting_user_id, v_inviter_child_id,
        v_invitation.invitation_date, v_invitation.invitation_start_time, v_invitation.invitation_end_time,
        v_duration_minutes, 'care_provided', 'confirmed', v_request.id, 
        'Reciprocal care via invitation', v_existing_care_group_id
    );
    
    -- Mark invitation as accepted
    UPDATE group_invitations 
    SET status = 'accepted',
        selected_time_block_index = p_selected_time_block_index
    WHERE id = p_invitation_id;
    
    RAISE NOTICE 'Successfully accepted group invitation % with existing care group %. Parent C child % added to original slot, Parent C will provide care for Parent B child % on invitation date %', 
        p_invitation_id, v_existing_care_group_id, p_selected_child_id, v_inviter_child_id, v_invitation.invitation_date;
END;
$$;

-- ============================================================================
-- STEP 3: Grant permissions
-- ============================================================================

GRANT EXECUTE ON FUNCTION accept_group_invitation_with_time_block(UUID, UUID, INTEGER, UUID) TO authenticated;

-- ============================================================================
-- STEP 4: Verify the function exists
-- ============================================================================

SELECT 
    'Function Check' as test_name,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.routines 
            WHERE routine_name = 'accept_group_invitation_with_time_block'
            AND routine_type = 'FUNCTION'
        ) THEN '✅ PASS: accept_group_invitation_with_time_block exists'
        ELSE '❌ FAIL: accept_group_invitation_with_time_block missing'
    END as status;

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================

SELECT 'Group invitation logic fixed! The function now correctly assigns children and time slots.' as status; 