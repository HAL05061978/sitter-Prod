-- Fix time blocks query and add child selection for invitation acceptance
-- This script fixes the get_available_time_blocks_for_invitation function and adds child selection

-- Step 1: Fix the get_available_time_blocks_for_invitation function
DROP FUNCTION IF EXISTS get_available_time_blocks_for_invitation(UUID);

CREATE OR REPLACE FUNCTION get_available_time_blocks_for_invitation(
    p_invitation_id UUID
) RETURNS TABLE (
    block_index INTEGER,
    block_date DATE,
    block_start_time TIME,
    block_end_time TIME,
    block_duration_minutes INTEGER,
    is_available BOOLEAN
) AS $$
DECLARE
    v_invitation_set_id UUID;
BEGIN
    -- Get the invitation set ID for this invitation
    SELECT invitation_set_id INTO v_invitation_set_id
    FROM public.invitation_time_blocks itb
    WHERE itb.selected_by_invitation_id = p_invitation_id
    LIMIT 1;
    
    -- If no invitation set found, try to find it through the invitation
    IF v_invitation_set_id IS NULL THEN
        SELECT itb.invitation_set_id INTO v_invitation_set_id
        FROM public.invitation_time_blocks itb
        JOIN public.group_invitations gi ON gi.id = p_invitation_id
        WHERE itb.invitation_set_id = (
            SELECT itb2.invitation_set_id 
            FROM public.invitation_time_blocks itb2
            WHERE itb2.invitation_set_id = itb.invitation_set_id
            LIMIT 1
        )
        LIMIT 1;
    END IF;
    
    RETURN QUERY
    SELECT 
        itb.block_index,
        itb.block_date,
        itb.block_start_time,
        itb.block_end_time,
        itb.block_duration_minutes,
        NOT itb.is_selected as is_available
    FROM public.invitation_time_blocks itb
    WHERE itb.invitation_set_id = v_invitation_set_id
    ORDER BY itb.block_index;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 2: Create function to get user's children for a group
CREATE OR REPLACE FUNCTION get_user_children_for_group(
    p_user_id UUID,
    p_group_id UUID
) RETURNS TABLE (
    child_id UUID,
    child_name TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        c.id as child_id,
        c.full_name as child_name
    FROM public.children c
    JOIN public.child_group_members cgm ON c.id = cgm.child_id
    WHERE c.parent_id = p_user_id
    AND cgm.group_id = p_group_id
    ORDER BY c.full_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 3: Update accept_group_invitation_with_time_block to accept child_id parameter
DROP FUNCTION IF EXISTS accept_group_invitation_with_time_block(UUID, UUID, INTEGER);

CREATE OR REPLACE FUNCTION accept_group_invitation_with_time_block(
    p_invitation_id UUID,
    p_accepting_user_id UUID,
    p_selected_time_block_index INTEGER,
    p_selected_child_id UUID
) RETURNS VOID AS $$
DECLARE
    v_invitation RECORD;
    v_time_block RECORD;
    v_request RECORD;
    v_inviter_child_id UUID;
    v_duration_minutes INTEGER;
BEGIN
    -- Get invitation details
    SELECT * INTO v_invitation
    FROM public.group_invitations
    WHERE id = p_invitation_id
    AND invitee_id = p_accepting_user_id
    AND status = 'pending';
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Invitation not found or not available for acceptance';
    END IF;
    
    -- Get request details
    SELECT * INTO v_request
    FROM public.babysitting_requests
    WHERE id = v_invitation.request_id;
    
    -- Check if the selected time block is available
    SELECT * INTO v_time_block
    FROM public.invitation_time_blocks
    WHERE invitation_set_id = (
        SELECT invitation_set_id 
        FROM public.invitation_time_blocks 
        WHERE selected_by_invitation_id = p_invitation_id
        LIMIT 1
    )
    AND block_index = p_selected_time_block_index
    AND is_selected = false;
    
    IF NOT FOUND THEN
        -- Try alternative method to find invitation set
        SELECT * INTO v_time_block
        FROM public.invitation_time_blocks
        WHERE invitation_set_id = (
            SELECT itb.invitation_set_id
            FROM public.invitation_time_blocks itb
            JOIN public.group_invitations gi ON gi.id = p_invitation_id
            WHERE itb.invitation_set_id IS NOT NULL
            LIMIT 1
        )
        AND block_index = p_selected_time_block_index
        AND is_selected = false;
        
        IF NOT FOUND THEN
            RAISE EXCEPTION 'Selected time block is not available';
        END IF;
    END IF;
    
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
    
    -- Mark the time block as selected
    UPDATE public.invitation_time_blocks
    SET is_selected = true,
        selected_by_invitation_id = p_invitation_id
    WHERE invitation_set_id = v_time_block.invitation_set_id
    AND block_index = p_selected_time_block_index;
    
    -- Update invitation status
    UPDATE public.group_invitations
    SET status = 'accepted',
        selected_time_block_index = p_selected_time_block_index
    WHERE id = p_invitation_id;
    
    -- Get inviter's child ID
    SELECT id INTO v_inviter_child_id
    FROM public.children
    WHERE parent_id = v_invitation.inviter_id
    LIMIT 1;
    
    -- Calculate duration
    v_duration_minutes := v_invitation.invitation_duration_minutes;
    
    -- Create scheduled blocks for the reciprocal arrangement
    -- 1. Inviter needs care (original request time)
    INSERT INTO public.scheduled_blocks (
        group_id, parent_id, child_id, scheduled_date, start_time, end_time, 
        duration_minutes, block_type, status, notes
    ) VALUES (
        v_invitation.group_id, v_invitation.inviter_id, v_inviter_child_id,
        v_request.requested_date, v_request.start_time, v_request.end_time,
        v_duration_minutes, 'care_needed', 'confirmed', v_request.notes
    );
    
    -- 2. Accepting user provides care for inviter's child
    INSERT INTO public.scheduled_blocks (
        group_id, parent_id, child_id, scheduled_date, start_time, end_time, 
        duration_minutes, block_type, status, notes
    ) VALUES (
        v_invitation.group_id, p_accepting_user_id, v_inviter_child_id,
        v_request.requested_date, v_request.start_time, v_request.end_time,
        v_duration_minutes, 'care_provided', 'confirmed', v_request.notes
    );
    
    -- 3. Accepting user needs care (selected time block) - using selected child
    INSERT INTO public.scheduled_blocks (
        group_id, parent_id, child_id, scheduled_date, start_time, end_time, 
        duration_minutes, block_type, status, notes
    ) VALUES (
        v_invitation.group_id, p_accepting_user_id, p_selected_child_id,
        v_time_block.block_date, v_time_block.block_start_time, v_time_block.block_end_time,
        v_duration_minutes, 'care_needed', 'confirmed', 
        COALESCE(v_invitation.notes, 'Reciprocal care arrangement')
    );
    
    -- 4. Inviter provides care for accepting user's child (selected child)
    INSERT INTO public.scheduled_blocks (
        group_id, parent_id, child_id, scheduled_date, start_time, end_time, 
        duration_minutes, block_type, status, notes
    ) VALUES (
        v_invitation.group_id, v_invitation.inviter_id, p_selected_child_id,
        v_time_block.block_date, v_time_block.block_start_time, v_time_block.block_end_time,
        v_duration_minutes, 'care_provided', 'confirmed', 
        COALESCE(v_invitation.notes, 'Reciprocal care arrangement')
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 4: Grant permissions
GRANT EXECUTE ON FUNCTION get_available_time_blocks_for_invitation(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_children_for_group(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION accept_group_invitation_with_time_block(UUID, UUID, INTEGER, UUID) TO authenticated;

-- Success message
SELECT 'Fixed time blocks query and added child selection!' as status; 