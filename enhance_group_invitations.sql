-- Enhanced Group Invitations System
-- This script enhances the group invitation system to support:
-- 1. Multiple time blocks per invitation (equal to number of invited parents)
-- 2. Parent selection (excluding the original initiator)
-- 3. First-come-first-served time block selection
-- 4. Prevention of duplicate selections

-- Step 1: Drop existing functions and tables that need to be replaced
DROP FUNCTION IF EXISTS invite_group_members_to_care(UUID, UUID, DATE, TIME, TIME);
DROP FUNCTION IF EXISTS accept_group_invitation(UUID, UUID);

-- Step 2: Create enhanced group invitations table with multiple time blocks
DROP TABLE IF EXISTS public.group_invitations CASCADE;
CREATE TABLE IF NOT EXISTS public.group_invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
    inviter_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    invitee_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    request_id UUID NOT NULL REFERENCES public.babysitting_requests(id) ON DELETE CASCADE,
    invitation_date DATE NOT NULL,
    invitation_start_time TIME NOT NULL,
    invitation_end_time TIME NOT NULL,
    invitation_duration_minutes INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
    selected_time_block_index INTEGER, -- Which time block this invitee selected (0-based)
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    -- Ensure end_time is after start_time
    CONSTRAINT valid_invitation_time_range CHECK (invitation_end_time > invitation_start_time),
    -- Ensure user can only be invited once per request
    UNIQUE(request_id, invitee_id)
);

-- Step 3: Create table to track time blocks for each invitation set
CREATE TABLE IF NOT EXISTS public.invitation_time_blocks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invitation_set_id UUID NOT NULL, -- Groups related invitations together
    block_index INTEGER NOT NULL, -- 0-based index of the time block
    block_date DATE NOT NULL,
    block_start_time TIME NOT NULL,
    block_end_time TIME NOT NULL,
    block_duration_minutes INTEGER NOT NULL,
    is_selected BOOLEAN DEFAULT false,
    selected_by_invitation_id UUID REFERENCES public.group_invitations(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    -- Ensure end_time is after start_time
    CONSTRAINT valid_block_time_range CHECK (block_end_time > block_start_time),
    -- Ensure unique block index per invitation set
    UNIQUE(invitation_set_id, block_index)
);

-- Step 4: Add RLS policies for new tables
ALTER TABLE public.group_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invitation_time_blocks ENABLE ROW LEVEL SECURITY;

-- Users can view invitations for their groups
CREATE POLICY "Users can view group invitations" ON public.group_invitations
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.group_members
        WHERE group_id = group_invitations.group_id
        AND profile_id = auth.uid()
        AND status = 'active'
    )
);

-- Users can create invitations for groups they're members of
CREATE POLICY "Users can create group invitations" ON public.group_invitations
FOR INSERT WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.group_members
        WHERE group_id = group_invitations.group_id
        AND profile_id = auth.uid()
        AND status = 'active'
    )
    AND inviter_id = auth.uid()
);

-- Users can update their own invitations or invitations they received
CREATE POLICY "Users can update group invitations" ON public.group_invitations
FOR UPDATE USING (
    inviter_id = auth.uid() OR invitee_id = auth.uid()
);

-- Users can view time blocks for their groups
CREATE POLICY "Users can view invitation time blocks" ON public.invitation_time_blocks
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.group_members gm
        JOIN public.group_invitations gi ON gm.group_id = gi.group_id
        WHERE gi.id = invitation_time_blocks.selected_by_invitation_id
        AND gm.profile_id = auth.uid()
        AND gm.status = 'active'
    )
);

-- Users can create time blocks for invitations they created
CREATE POLICY "Users can create invitation time blocks" ON public.invitation_time_blocks
FOR INSERT WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.group_invitations
        WHERE id = invitation_time_blocks.selected_by_invitation_id
        AND inviter_id = auth.uid()
    )
);

-- Users can update time blocks for their invitations
CREATE POLICY "Users can update invitation time blocks" ON public.invitation_time_blocks
FOR UPDATE USING (
    EXISTS (
        SELECT 1 FROM public.group_invitations
        WHERE id = invitation_time_blocks.selected_by_invitation_id
        AND (inviter_id = auth.uid() OR invitee_id = auth.uid())
    )
);

-- Step 5: Create enhanced function to invite specific parents with multiple time blocks
CREATE OR REPLACE FUNCTION invite_specific_parents_to_care(
    p_request_id UUID,
    p_inviter_id UUID,
    p_invitee_ids UUID[],
    p_time_blocks JSONB -- Array of time block objects: [{"date": "2024-01-15", "start_time": "09:00", "end_time": "12:00"}, ...]
) RETURNS UUID AS $$
DECLARE
    v_invitation_set_id UUID;
    v_time_block JSONB;
    v_block_index INTEGER := 0;
    v_invitee_index INTEGER := 0;
    v_invitee_id UUID;
    v_request RECORD;
    v_group_id UUID;
    v_initiator_id UUID;
BEGIN
    -- Get request details
    SELECT group_id, initiator_id INTO v_request
    FROM public.babysitting_requests
    WHERE id = p_request_id;
    
    v_group_id := v_request.group_id;
    v_initiator_id := v_request.initiator_id;
    
    -- Validate that inviter is a member of the group
    IF NOT EXISTS (
        SELECT 1 FROM public.group_members
        WHERE group_id = v_group_id
        AND profile_id = p_inviter_id
        AND status = 'active'
    ) THEN
        RAISE EXCEPTION 'Inviter is not an active member of the group';
    END IF;
    
    -- Validate that all invitees are members of the group and not the initiator
    FOREACH v_invitee_id IN ARRAY p_invitee_ids
    LOOP
        IF v_invitee_id = v_initiator_id THEN
            RAISE EXCEPTION 'Cannot invite the original request initiator';
        END IF;
        
        IF NOT EXISTS (
            SELECT 1 FROM public.group_members
            WHERE group_id = v_group_id
            AND profile_id = v_invitee_id
            AND status = 'active'
        ) THEN
            RAISE EXCEPTION 'Invitee % is not an active member of the group', v_invitee_id;
        END IF;
    END LOOP;
    
    -- Validate that number of time blocks matches number of invitees
    IF array_length(p_invitee_ids, 1) != jsonb_array_length(p_time_blocks) THEN
        RAISE EXCEPTION 'Number of time blocks must match number of invitees';
    END IF;
    
    -- Generate invitation set ID
    v_invitation_set_id := gen_random_uuid();
    
    -- Create time blocks
    FOR v_time_block IN SELECT * FROM jsonb_array_elements(p_time_blocks)
    LOOP
        INSERT INTO public.invitation_time_blocks (
            invitation_set_id,
            block_index,
            block_date,
            block_start_time,
            block_end_time,
            block_duration_minutes
        ) VALUES (
            v_invitation_set_id,
            v_block_index,
            (v_time_block->>'date')::DATE,
            (v_time_block->>'start_time')::TIME,
            (v_time_block->>'end_time')::TIME,
            EXTRACT(EPOCH FROM ((v_time_block->>'end_time')::TIME - (v_time_block->>'start_time')::TIME)) / 60
        );
        
        v_block_index := v_block_index + 1;
    END LOOP;
    
    -- Create invitations for each invitee
    v_invitee_index := 0;
    FOREACH v_invitee_id IN ARRAY p_invitee_ids
    LOOP
        INSERT INTO public.group_invitations (
            group_id,
            inviter_id,
            invitee_id,
            request_id,
            invitation_date,
            invitation_start_time,
            invitation_end_time,
            invitation_duration_minutes
        ) VALUES (
            v_group_id,
            p_inviter_id,
            v_invitee_id,
            p_request_id,
            (p_time_blocks->v_invitee_index->>'date')::DATE,
            (p_time_blocks->v_invitee_index->>'start_time')::TIME,
            (p_time_blocks->v_invitee_index->>'end_time')::TIME,
            EXTRACT(EPOCH FROM ((p_time_blocks->v_invitee_index->>'end_time')::TIME - (p_time_blocks->v_invitee_index->>'start_time')::TIME)) / 60
        );
        
        v_invitee_index := v_invitee_index + 1;
    END LOOP;
    
    RETURN v_invitation_set_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 6: Create enhanced function to accept invitations with time block selection
CREATE OR REPLACE FUNCTION accept_group_invitation_with_time_block(
    p_invitation_id UUID,
    p_accepting_user_id UUID,
    p_selected_time_block_index INTEGER
) RETURNS VOID AS $$
DECLARE
    v_invitation RECORD;
    v_time_block RECORD;
    v_request RECORD;
    v_inviter_child_id UUID;
    v_accepting_child_id UUID;
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
        RAISE EXCEPTION 'Selected time block is not available';
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
    
    -- Get child IDs
    SELECT id INTO v_inviter_child_id
    FROM public.children
    WHERE parent_id = v_invitation.inviter_id
    LIMIT 1;
    
    SELECT id INTO v_accepting_child_id
    FROM public.children
    WHERE parent_id = p_accepting_user_id
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
    
    -- 3. Accepting user needs care (selected time block)
    INSERT INTO public.scheduled_blocks (
        group_id, parent_id, child_id, scheduled_date, start_time, end_time, 
        duration_minutes, block_type, status, notes
    ) VALUES (
        v_invitation.group_id, p_accepting_user_id, v_accepting_child_id,
        v_time_block.block_date, v_time_block.block_start_time, v_time_block.block_end_time,
        v_duration_minutes, 'care_needed', 'confirmed', 
        COALESCE(v_invitation.notes, 'Reciprocal care arrangement')
    );
    
    -- 4. Inviter provides care for accepting user's child
    INSERT INTO public.scheduled_blocks (
        group_id, parent_id, child_id, scheduled_date, start_time, end_time, 
        duration_minutes, block_type, status, notes
    ) VALUES (
        v_invitation.group_id, v_invitation.inviter_id, v_accepting_child_id,
        v_time_block.block_date, v_time_block.block_start_time, v_time_block.block_end_time,
        v_duration_minutes, 'care_provided', 'confirmed', 
        COALESCE(v_invitation.notes, 'Reciprocal care arrangement')
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 7: Create function to get available time blocks for an invitation
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
BEGIN
    RETURN QUERY
    SELECT 
        itb.block_index,
        itb.block_date,
        itb.block_start_time,
        itb.block_end_time,
        itb.block_duration_minutes,
        NOT itb.is_selected as is_available
    FROM public.invitation_time_blocks itb
    JOIN public.group_invitations gi ON gi.id = itb.selected_by_invitation_id
    WHERE gi.id = p_invitation_id
    ORDER BY itb.block_index;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 8: Create function to get group members available for invitation (excluding initiator)
CREATE OR REPLACE FUNCTION get_available_group_members_for_invitation(
    p_group_id UUID,
    p_initiator_id UUID
) RETURNS TABLE (
    profile_id UUID,
    full_name TEXT,
    email TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.id as profile_id,
        p.full_name,
        p.email
    FROM public.profiles p
    JOIN public.group_members gm ON p.id = gm.profile_id
    WHERE gm.group_id = p_group_id
    AND gm.status = 'active'
    AND p.id != p_initiator_id
    ORDER BY p.full_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 9: Grant permissions
GRANT EXECUTE ON FUNCTION invite_specific_parents_to_care(UUID, UUID, UUID[], JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION accept_group_invitation_with_time_block(UUID, UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION get_available_time_blocks_for_invitation(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_available_group_members_for_invitation(UUID, UUID) TO authenticated;

-- Success message
SELECT 'Enhanced group invitation system created successfully!' as status; 