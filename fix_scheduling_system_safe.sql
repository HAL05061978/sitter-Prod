-- Safe Comprehensive Fix for Scheduling System
-- This script addresses all identified issues and aligns with the expected invitation workflow
-- This version checks for existing policies and functions to avoid conflicts

-- ============================================================================
-- STEP 1: Ensure all required tables exist with correct structure
-- ============================================================================

-- Add care_group_id column to scheduled_blocks if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'scheduled_blocks' 
        AND column_name = 'care_group_id'
    ) THEN
        ALTER TABLE public.scheduled_blocks ADD COLUMN care_group_id UUID;
        RAISE NOTICE 'Added care_group_id column to scheduled_blocks table';
    ELSE
        RAISE NOTICE 'care_group_id column already exists in scheduled_blocks table';
    END IF;
END $$;

-- Create group_invitations table with proper structure
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
    selected_time_block_index INTEGER,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    -- Ensure end_time is after start_time
    CONSTRAINT valid_invitation_time_range CHECK (invitation_end_time > invitation_start_time),
    -- Ensure user can only be invited once per request
    UNIQUE(request_id, invitee_id)
);

-- Create invitation_time_blocks table for multiple time block invitations
CREATE TABLE IF NOT EXISTS public.invitation_time_blocks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invitation_set_id UUID NOT NULL,
    block_index INTEGER NOT NULL,
    block_date DATE NOT NULL,
    block_start_time TIME NOT NULL,
    block_end_time TIME NOT NULL,
    block_duration_minutes INTEGER NOT NULL,
    is_available BOOLEAN DEFAULT true,
    selected_by_invitation_id UUID REFERENCES public.group_invitations(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    -- Ensure end_time is after start_time
    CONSTRAINT valid_time_block_range CHECK (block_end_time > block_start_time)
);

-- ============================================================================
-- STEP 2: Add RLS policies for new tables (only if they don't exist)
-- ============================================================================

-- Enable RLS on group_invitations
ALTER TABLE public.group_invitations ENABLE ROW LEVEL SECURITY;

-- Users can view invitations for their groups (only create if doesn't exist)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'group_invitations' 
        AND policyname = 'Users can view group invitations'
    ) THEN
        CREATE POLICY "Users can view group invitations" ON public.group_invitations
        FOR SELECT USING (
            EXISTS (
                SELECT 1 FROM public.group_members
                WHERE group_id = group_invitations.group_id
                AND profile_id = auth.uid()
                AND status = 'active'
            )
        );
        RAISE NOTICE 'Created "Users can view group invitations" policy';
    ELSE
        RAISE NOTICE 'Policy "Users can view group invitations" already exists';
    END IF;
END $$;

-- Users can create invitations for groups they're members of (only create if doesn't exist)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'group_invitations' 
        AND policyname = 'Users can create group invitations'
    ) THEN
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
        RAISE NOTICE 'Created "Users can create group invitations" policy';
    ELSE
        RAISE NOTICE 'Policy "Users can create group invitations" already exists';
    END IF;
END $$;

-- Users can update their own invitations or invitations they received (only create if doesn't exist)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'group_invitations' 
        AND policyname = 'Users can update group invitations'
    ) THEN
        CREATE POLICY "Users can update group invitations" ON public.group_invitations
        FOR UPDATE USING (
            inviter_id = auth.uid() OR invitee_id = auth.uid()
        );
        RAISE NOTICE 'Created "Users can update group invitations" policy';
    ELSE
        RAISE NOTICE 'Policy "Users can update group invitations" already exists';
    END IF;
END $$;

-- Enable RLS on invitation_time_blocks
ALTER TABLE public.invitation_time_blocks ENABLE ROW LEVEL SECURITY;

-- Users can view time blocks for invitations in their groups (only create if doesn't exist)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'invitation_time_blocks' 
        AND policyname = 'Users can view invitation time blocks'
    ) THEN
        CREATE POLICY "Users can view invitation time blocks" ON public.invitation_time_blocks
        FOR SELECT USING (
            EXISTS (
                SELECT 1 FROM public.group_invitations gi
                JOIN public.group_members gm ON gm.group_id = gi.group_id
                WHERE gi.id = invitation_time_blocks.selected_by_invitation_id
                AND gm.profile_id = auth.uid()
                AND gm.status = 'active'
            )
        );
        RAISE NOTICE 'Created "Users can view invitation time blocks" policy';
    ELSE
        RAISE NOTICE 'Policy "Users can view invitation time blocks" already exists';
    END IF;
END $$;

-- Users can create time blocks for their invitations (only create if doesn't exist)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'invitation_time_blocks' 
        AND policyname = 'Users can create invitation time blocks'
    ) THEN
        CREATE POLICY "Users can create invitation time blocks" ON public.invitation_time_blocks
        FOR INSERT WITH CHECK (
            EXISTS (
                SELECT 1 FROM public.group_invitations
                WHERE id = invitation_time_blocks.selected_by_invitation_id
                AND inviter_id = auth.uid()
            )
        );
        RAISE NOTICE 'Created "Users can create invitation time blocks" policy';
    ELSE
        RAISE NOTICE 'Policy "Users can create invitation time blocks" already exists';
    END IF;
END $$;

-- Users can update time blocks for their invitations (only create if doesn't exist)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'invitation_time_blocks' 
        AND policyname = 'Users can update invitation time blocks'
    ) THEN
        CREATE POLICY "Users can update invitation time blocks" ON public.invitation_time_blocks
        FOR UPDATE USING (
            EXISTS (
                SELECT 1 FROM public.group_invitations
                WHERE id = invitation_time_blocks.selected_by_invitation_id
                AND (inviter_id = auth.uid() OR invitee_id = auth.uid())
            )
        );
        RAISE NOTICE 'Created "Users can update invitation time blocks" policy';
    ELSE
        RAISE NOTICE 'Policy "Users can update invitation time blocks" already exists';
    END IF;
END $$;

-- ============================================================================
-- STEP 3: Create missing functions (will replace if they exist)
-- ============================================================================

-- Function to get available group members for invitation (excluding initiator)
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
    JOIN public.group_members gm ON gm.profile_id = p.id
    WHERE gm.group_id = p_group_id
    AND gm.status = 'active'
    AND p.id != p_initiator_id
    ORDER BY p.full_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to invite specific parents to care with multiple time blocks
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
            invitation_duration_minutes,
            notes
        ) VALUES (
            v_group_id,
            p_inviter_id,
            v_invitee_id,
            p_request_id,
            (p_time_blocks->v_invitee_index->>'date')::DATE,
            (p_time_blocks->v_invitee_index->>'start_time')::TIME,
            (p_time_blocks->v_invitee_index->>'end_time')::TIME,
            EXTRACT(EPOCH FROM ((p_time_blocks->v_invitee_index->>'end_time')::TIME - (p_time_blocks->v_invitee_index->>'start_time')::TIME)) / 60,
            'Invitation to join existing care arrangement'
        );
        
        v_invitee_index := v_invitee_index + 1;
    END LOOP;
    
    RETURN v_invitation_set_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get available time blocks for an invitation
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
    v_invitation RECORD;
BEGIN
    -- Get invitation details
    SELECT * INTO v_invitation
    FROM public.group_invitations
    WHERE id = p_invitation_id;
    
    -- Return the time block for this invitation
    RETURN QUERY
    SELECT 
        0 as block_index,
        v_invitation.invitation_date as block_date,
        v_invitation.invitation_start_time as block_start_time,
        v_invitation.invitation_end_time as block_end_time,
        v_invitation.invitation_duration_minutes as block_duration_minutes,
        v_invitation.status = 'pending' as is_available;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get user's children for a specific group (handle existing function with different return type)
DO $$
BEGIN
    -- Drop the function if it exists with different return type
    IF EXISTS (
        SELECT 1 FROM pg_proc 
        WHERE proname = 'get_user_children_for_group' 
        AND pronargs = 2
    ) THEN
        DROP FUNCTION IF EXISTS get_user_children_for_group(UUID, UUID);
    END IF;
END $$;

CREATE OR REPLACE FUNCTION get_user_children_for_group(
    p_user_id UUID,
    p_group_id UUID
) RETURNS TABLE (
    id UUID,
    full_name TEXT,
    parent_id UUID
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        c.id,
        c.full_name,
        c.parent_id
    FROM public.children c
    JOIN public.child_group_members cgm ON cgm.child_id = c.id
    WHERE c.parent_id = p_user_id
    AND cgm.group_id = p_group_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to accept group invitation with time block selection (handle existing function with different parameter names)
DO $$
BEGIN
    -- Drop the function if it exists with different parameter names
    IF EXISTS (
        SELECT 1 FROM pg_proc 
        WHERE proname = 'accept_group_invitation_with_time_block' 
        AND pronargs = 4
    ) THEN
        DROP FUNCTION IF EXISTS accept_group_invitation_with_time_block(UUID, UUID, INTEGER, UUID);
    END IF;
END $$;

CREATE OR REPLACE FUNCTION accept_group_invitation_with_time_block(
    p_invitation_id UUID,
    p_accepting_user_id UUID,
    p_selected_time_block_index INTEGER,
    p_selected_child_id UUID
) RETURNS VOID AS $$
DECLARE
    v_invitation RECORD;
    v_request RECORD;
    v_existing_care_group_id UUID;
    v_duration_minutes INTEGER;
    v_inviter_child_id UUID;
BEGIN
    -- Get invitation details
    SELECT * INTO v_invitation
    FROM public.group_invitations
    WHERE id = p_invitation_id;
    
    -- Get request details
    SELECT * INTO v_request
    FROM public.babysitting_requests
    WHERE id = v_invitation.request_id;
    
    -- Calculate duration
    v_duration_minutes := EXTRACT(EPOCH FROM (v_invitation.invitation_end_time - v_invitation.invitation_start_time)) / 60;
    
    -- Get inviter's child (for the care they're providing)
    SELECT id INTO v_inviter_child_id
    FROM public.children
    WHERE parent_id = v_invitation.inviter_id
    LIMIT 1;
    
    -- Find existing care group for this request
    SELECT care_group_id INTO v_existing_care_group_id
    FROM public.scheduled_blocks
    WHERE request_id = v_invitation.request_id
    AND care_group_id IS NOT NULL
    LIMIT 1;
    
    -- If no existing care group, create one
    IF v_existing_care_group_id IS NULL THEN
        v_existing_care_group_id := gen_random_uuid();
    END IF;
    
    -- Create scheduled block for the accepting user needing care
    INSERT INTO public.scheduled_blocks (
        group_id, parent_id, child_id, scheduled_date, start_time, end_time,
        duration_minutes, block_type, status, request_id, notes, care_group_id
    ) VALUES (
        v_invitation.group_id, p_accepting_user_id, p_selected_child_id,
        v_invitation.invitation_date, v_invitation.invitation_start_time, v_invitation.invitation_end_time,
        v_duration_minutes, 'care_needed', 'confirmed', v_invitation.request_id,
        'Added via group invitation', v_existing_care_group_id
    );
    
    -- Create scheduled block for the inviter providing care (if they have a child)
    IF v_inviter_child_id IS NOT NULL THEN
        INSERT INTO public.scheduled_blocks (
            group_id, parent_id, child_id, scheduled_date, start_time, end_time,
            duration_minutes, block_type, status, request_id, notes, care_group_id
        ) VALUES (
            v_invitation.group_id, v_invitation.inviter_id, v_inviter_child_id,
            v_invitation.invitation_date, v_invitation.invitation_start_time, v_invitation.invitation_end_time,
            v_duration_minutes, 'care_provided', 'confirmed', v_invitation.request_id,
            'Reciprocal care via invitation', v_existing_care_group_id
        );
    END IF;
    
    -- Update invitation status
    UPDATE public.group_invitations
    SET status = 'accepted', selected_time_block_index = p_selected_time_block_index
    WHERE id = p_invitation_id;
    
    RAISE NOTICE 'Successfully accepted invitation % and created scheduled blocks with care group %', p_invitation_id, v_existing_care_group_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get children in a care block
CREATE OR REPLACE FUNCTION get_children_in_care_block(
    p_care_group_id UUID
) RETURNS TABLE (
    child_name TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT DISTINCT c.full_name as child_name
    FROM public.scheduled_blocks sb
    JOIN public.children c ON c.id = sb.child_id
    WHERE sb.care_group_id = p_care_group_id
    ORDER BY c.full_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to create care exchange when Parent A accepts Parent B's response
CREATE OR REPLACE FUNCTION create_care_exchange(
    p_request_id UUID,
    p_response_id UUID
) RETURNS VOID AS $$
DECLARE
    v_request RECORD;
    v_response RECORD;
    v_care_group_id UUID;
    v_reciprocal_duration_minutes INTEGER;
BEGIN
    -- Get request and response details
    SELECT * INTO v_request FROM public.babysitting_requests WHERE id = p_request_id;
    SELECT * INTO v_response FROM public.request_responses WHERE id = p_response_id;
    
    -- Generate care group ID
    v_care_group_id := gen_random_uuid();
    
    -- Create scheduled block for Parent A needing care
    INSERT INTO public.scheduled_blocks (
        group_id, parent_id, child_id, scheduled_date, start_time, end_time,
        duration_minutes, block_type, status, request_id, notes, care_group_id
    ) VALUES (
        v_request.group_id, v_request.initiator_id, v_request.child_id,
        v_request.requested_date, v_request.start_time, v_request.end_time,
        v_request.duration_minutes, 'care_needed', 'confirmed', v_request.id, v_request.notes, v_care_group_id
    );
    
    -- Create scheduled block for Parent B providing care
    INSERT INTO public.scheduled_blocks (
        group_id, parent_id, child_id, scheduled_date, start_time, end_time,
        duration_minutes, block_type, status, request_id, notes, care_group_id
    ) VALUES (
        v_request.group_id, v_response.responder_id, v_request.child_id,
        v_request.requested_date, v_request.start_time, v_request.end_time,
        v_request.duration_minutes, 'care_provided', 'confirmed', v_request.id, v_response.notes, v_care_group_id
    );
    
    -- Update response status
    UPDATE public.request_responses
    SET status = 'accepted'
    WHERE id = p_response_id;
    
    -- Close the request
    UPDATE public.babysitting_requests
    SET status = 'closed'
    WHERE id = p_request_id;
    
    RAISE NOTICE 'Successfully processed care exchange for request % and response % with care group %', p_request_id, p_response_id, v_care_group_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to select one response and reject others
CREATE OR REPLACE FUNCTION select_response_and_reject_others(
    p_response_id UUID
) RETURNS VOID AS $$
DECLARE
    v_request_id UUID;
BEGIN
    -- Get the request ID for this response
    SELECT request_id INTO v_request_id
    FROM public.request_responses
    WHERE id = p_response_id;
    
    -- Reject all other pending responses for this request
    UPDATE public.request_responses
    SET status = 'declined'
    WHERE request_id = v_request_id
    AND id != p_response_id
    AND status = 'pending';
    
    -- Accept the selected response
    UPDATE public.request_responses
    SET status = 'accepted'
    WHERE id = p_response_id;
    
    -- Create the care exchange
    PERFORM create_care_exchange(v_request_id, p_response_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- STEP 4: Grant permissions (only if not already granted)
-- ============================================================================

-- Grant permissions for group_invitations
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.role_table_grants 
        WHERE table_name = 'group_invitations' 
        AND grantee = 'authenticated'
        AND privilege_type = 'SELECT'
    ) THEN
        GRANT SELECT, INSERT, UPDATE ON public.group_invitations TO authenticated;
        RAISE NOTICE 'Granted permissions on group_invitations to authenticated';
    ELSE
        RAISE NOTICE 'Permissions on group_invitations already granted to authenticated';
    END IF;
END $$;

-- Grant permissions for invitation_time_blocks
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.role_table_grants 
        WHERE table_name = 'invitation_time_blocks' 
        AND grantee = 'authenticated'
        AND privilege_type = 'SELECT'
    ) THEN
        GRANT SELECT, INSERT, UPDATE ON public.invitation_time_blocks TO authenticated;
        RAISE NOTICE 'Granted permissions on invitation_time_blocks to authenticated';
    ELSE
        RAISE NOTICE 'Permissions on invitation_time_blocks already granted to authenticated';
    END IF;
END $$;

-- Grant function permissions
GRANT EXECUTE ON FUNCTION get_available_group_members_for_invitation(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION invite_specific_parents_to_care(UUID, UUID, UUID[], JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION get_available_time_blocks_for_invitation(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_children_for_group(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION accept_group_invitation_with_time_block(UUID, UUID, INTEGER, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_children_in_care_block(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION create_care_exchange(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION select_response_and_reject_others(UUID) TO authenticated;

-- ============================================================================
-- STEP 5: Create indexes for performance (only if they don't exist)
-- ============================================================================

-- Create indexes only if they don't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE tablename = 'group_invitations' 
        AND indexname = 'idx_group_invitations_invitee_id'
    ) THEN
        CREATE INDEX idx_group_invitations_invitee_id ON public.group_invitations(invitee_id);
        RAISE NOTICE 'Created idx_group_invitations_invitee_id index';
    ELSE
        RAISE NOTICE 'Index idx_group_invitations_invitee_id already exists';
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE tablename = 'group_invitations' 
        AND indexname = 'idx_group_invitations_status'
    ) THEN
        CREATE INDEX idx_group_invitations_status ON public.group_invitations(status);
        RAISE NOTICE 'Created idx_group_invitations_status index';
    ELSE
        RAISE NOTICE 'Index idx_group_invitations_status already exists';
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE tablename = 'group_invitations' 
        AND indexname = 'idx_group_invitations_request_id'
    ) THEN
        CREATE INDEX idx_group_invitations_request_id ON public.group_invitations(request_id);
        RAISE NOTICE 'Created idx_group_invitations_request_id index';
    ELSE
        RAISE NOTICE 'Index idx_group_invitations_request_id already exists';
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE tablename = 'invitation_time_blocks' 
        AND indexname = 'idx_invitation_time_blocks_set_id'
    ) THEN
        CREATE INDEX idx_invitation_time_blocks_set_id ON public.invitation_time_blocks(invitation_set_id);
        RAISE NOTICE 'Created idx_invitation_time_blocks_set_id index';
    ELSE
        RAISE NOTICE 'Index idx_invitation_time_blocks_set_id already exists';
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE tablename = 'scheduled_blocks' 
        AND indexname = 'idx_scheduled_blocks_care_group_id'
    ) THEN
        CREATE INDEX idx_scheduled_blocks_care_group_id ON public.scheduled_blocks(care_group_id);
        RAISE NOTICE 'Created idx_scheduled_blocks_care_group_id index';
    ELSE
        RAISE NOTICE 'Index idx_scheduled_blocks_care_group_id already exists';
    END IF;
END $$;

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================

SELECT 'Safe scheduling system fix completed successfully! All components checked and created/updated as needed.' as status; 