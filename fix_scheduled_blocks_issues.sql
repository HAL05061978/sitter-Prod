-- Fix Scheduled Blocks Issues
-- This script fixes the care type issues and adds support for showing all children in a care block
-- Run this in your Supabase SQL editor

-- ============================================================================
-- STEP 1: Fix the accept_group_invitation_with_time_block function
-- ============================================================================

DROP FUNCTION IF EXISTS accept_group_invitation_with_time_block(UUID, UUID, INTEGER, UUID);

CREATE OR REPLACE FUNCTION accept_group_invitation_with_time_block(
    p_invitation_id UUID,
    p_accepting_user_id UUID,
    p_selected_time_block_index INTEGER,
    p_selected_child_id UUID
) RETURNS VOID AS $$
DECLARE
    v_invitation group_invitations%ROWTYPE;
    v_request babysitting_requests%ROWTYPE;
    v_duration_minutes INTEGER;
    v_care_group_id UUID;
BEGIN
    -- Get the invitation details
    SELECT * INTO v_invitation 
    FROM group_invitations 
    WHERE id = p_invitation_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Invitation not found';
    END IF;
    
    IF v_invitation.status != 'pending' THEN
        RAISE EXCEPTION 'Invitation is not pending';
    END IF;
    
    IF v_invitation.invitee_id != p_accepting_user_id THEN
        RAISE EXCEPTION 'You can only accept invitations sent to you';
    END IF;
    
    -- Get the original request details
    SELECT * INTO v_request 
    FROM babysitting_requests 
    WHERE id = v_invitation.request_id;
    
    -- Validate that the selected child belongs to the accepting user and is in the group
    IF NOT EXISTS (
        SELECT 1 FROM public.children c
        JOIN public.child_group_members cgm ON c.id = cgm.child_id
        WHERE c.id = p_selected_child_id
        AND c.parent_id = p_accepting_user_id
        AND cgm.group_id = v_invitation.group_id
    ) THEN
        RAISE EXCEPTION 'Selected child is not valid for this group';
    END IF;
    
    -- Calculate duration
    v_duration_minutes := v_invitation.invitation_duration_minutes;
    
    -- Generate a care group ID to link related blocks
    v_care_group_id := gen_random_uuid();
    
    -- Update invitation status
    UPDATE group_invitations 
    SET 
        status = 'accepted',
        selected_time_block_index = p_selected_time_block_index
    WHERE id = p_invitation_id;
    
    -- Create scheduled blocks for the reciprocal arrangement
    
    -- 1. Original request: Parent A needs care, Parent B provides care
    INSERT INTO scheduled_blocks (
        group_id,
        parent_id,
        child_id,
        scheduled_date,
        start_time,
        end_time,
        duration_minutes,
        block_type,
        status,
        request_id,
        notes,
        care_group_id
    ) VALUES (
        v_request.group_id,
        v_request.initiator_id,  -- Parent A needs care
        v_request.child_id,
        v_request.requested_date,
        v_request.start_time,
        v_request.end_time,
        v_request.duration_minutes,
        'care_needed',
        'confirmed',
        v_request.id,
        v_request.notes,
        v_care_group_id
    );
    
    INSERT INTO scheduled_blocks (
        group_id,
        parent_id,
        child_id,
        scheduled_date,
        start_time,
        end_time,
        duration_minutes,
        block_type,
        status,
        request_id,
        notes,
        care_group_id
    ) VALUES (
        v_request.group_id,
        v_invitation.inviter_id,  -- Parent B provides care
        v_request.child_id,
        v_request.requested_date,
        v_request.start_time,
        v_request.end_time,
        v_request.duration_minutes,
        'care_provided',
        'confirmed',
        v_request.id,
        v_request.notes,
        v_care_group_id
    );
    
    -- 2. Reciprocal arrangement: Parent B needs care, Parent C provides care
    INSERT INTO scheduled_blocks (
        group_id,
        parent_id,
        child_id,
        scheduled_date,
        start_time,
        end_time,
        duration_minutes,
        block_type,
        status,
        request_id,
        notes,
        care_group_id
    ) VALUES (
        v_invitation.group_id,
        v_invitation.inviter_id,  -- Parent B needs care
        p_selected_child_id,
        v_invitation.invitation_date,
        v_invitation.invitation_start_time,
        v_invitation.invitation_end_time,
        v_duration_minutes,
        'care_needed',
        'confirmed',
        v_request.id,
        v_invitation.notes,
        v_care_group_id
    );
    
    INSERT INTO scheduled_blocks (
        group_id,
        parent_id,
        child_id,
        scheduled_date,
        start_time,
        end_time,
        duration_minutes,
        block_type,
        status,
        request_id,
        notes,
        care_group_id
    ) VALUES (
        v_invitation.group_id,
        p_accepting_user_id,  -- Parent C provides care
        p_selected_child_id,
        v_invitation.invitation_date,
        v_invitation.invitation_start_time,
        v_invitation.invitation_end_time,
        v_duration_minutes,
        'care_provided',
        'confirmed',
        v_request.id,
        v_invitation.notes,
        v_care_group_id
    );
    
    RAISE NOTICE 'Successfully accepted invitation % and created scheduled blocks with care group %', p_invitation_id, v_care_group_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- STEP 2: Add care_group_id column to scheduled_blocks table
-- ============================================================================

-- Add care_group_id column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'scheduled_blocks' 
        AND column_name = 'care_group_id'
    ) THEN
        ALTER TABLE public.scheduled_blocks ADD COLUMN care_group_id UUID;
    END IF;
END $$;

-- ============================================================================
-- STEP 3: Create function to get all children in a care block
-- ============================================================================

CREATE OR REPLACE FUNCTION get_children_in_care_block(
    p_care_group_id UUID
) RETURNS TABLE (
    child_id UUID,
    child_name TEXT,
    parent_name TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        c.id as child_id,
        c.full_name as child_name,
        p.full_name as parent_name
    FROM public.scheduled_blocks sb
    JOIN public.children c ON sb.child_id = c.id
    JOIN public.profiles p ON c.parent_id = p.id
    WHERE sb.care_group_id = p_care_group_id
    ORDER BY c.full_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- STEP 4: Grant permissions
-- ============================================================================

GRANT EXECUTE ON FUNCTION accept_group_invitation_with_time_block(UUID, UUID, INTEGER, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_children_in_care_block(UUID) TO authenticated;

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================

SELECT 'Scheduled blocks issues fixed! The system now:
1. Creates correct care_needed/care_provided blocks
2. Links related blocks with care_group_id
3. Can show all children in a care block' as status; 