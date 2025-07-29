-- Simplify Scheduling System
-- Remove complex reciprocal care system and replace with simple invite system

-- Step 1: Remove complex reciprocal care fields from request_responses
ALTER TABLE public.request_responses 
DROP COLUMN IF EXISTS reciprocal_date,
DROP COLUMN IF EXISTS reciprocal_start_time,
DROP COLUMN IF EXISTS reciprocal_end_time,
DROP COLUMN IF EXISTS reciprocal_duration_minutes,
DROP COLUMN IF EXISTS reciprocal_child_id,
DROP COLUMN IF EXISTS keep_open_to_others,
DROP COLUMN IF EXISTS initiator_agreed;

-- Step 2: Drop complex triggers and functions
DROP TRIGGER IF EXISTS close_request_trigger ON public.request_responses;
DROP TRIGGER IF EXISTS create_additional_care_trigger ON public.request_responses;
DROP TRIGGER IF EXISTS create_initial_scheduled_blocks_trigger ON public.request_responses;
DROP FUNCTION IF EXISTS close_request_if_not_open_to_others();
DROP FUNCTION IF EXISTS create_additional_care_request();
DROP FUNCTION IF EXISTS create_initial_scheduled_blocks();

-- Step 3: Create new table for group invitations
CREATE TABLE IF NOT EXISTS public.group_invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
    inviter_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    invitee_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    request_id UUID NOT NULL REFERENCES public.babysitting_requests(id) ON DELETE CASCADE,
    invited_date DATE NOT NULL,
    invited_start_time TIME NOT NULL,
    invited_end_time TIME NOT NULL,
    invited_duration_minutes INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    -- Ensure end_time is after start_time
    CONSTRAINT valid_invitation_time_range CHECK (invited_end_time > invited_start_time),
    -- Ensure user can only be invited once per request
    UNIQUE(request_id, invitee_id)
);

-- Step 4: Add RLS policies for group_invitations
ALTER TABLE public.group_invitations ENABLE ROW LEVEL SECURITY;

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

-- Step 5: Create function to create initial scheduled blocks when Parent B agrees to Parent A's request
CREATE OR REPLACE FUNCTION create_initial_scheduled_blocks() RETURNS TRIGGER AS $$
DECLARE
    v_request RECORD;
    v_responder_child_id UUID;
    v_initiator_child_id UUID;
    v_duration_minutes INTEGER;
BEGIN
    -- Only proceed if this is an 'agree' response
    IF NEW.response_type != 'agree' THEN
        RETURN NEW;
    END IF;
    
    -- Get the request details
    SELECT * INTO v_request
    FROM public.babysitting_requests
    WHERE id = NEW.request_id;
    
    -- Get the responder's child (assuming they have one child for simplicity)
    SELECT id INTO v_responder_child_id
    FROM public.children
    WHERE parent_id = NEW.responder_id
    LIMIT 1;
    
    -- Get the initiator's child
    v_initiator_child_id := v_request.child_id;
    
    -- Calculate duration
    v_duration_minutes := v_request.duration_minutes;
    
    -- Create scheduled blocks for the initial reciprocal agreement
    -- 1. Parent A needs care (original request)
    INSERT INTO public.scheduled_blocks (
        group_id, parent_id, child_id, scheduled_date, start_time, end_time, 
        duration_minutes, block_type, status, notes
    ) VALUES (
        v_request.group_id, v_request.initiator_id, v_initiator_child_id,
        v_request.requested_date, v_request.start_time, v_request.end_time,
        v_duration_minutes, 'care_needed', 'confirmed', v_request.notes
    );
    
    -- 2. Parent B provides care for Parent A's child
    INSERT INTO public.scheduled_blocks (
        group_id, parent_id, child_id, scheduled_date, start_time, end_time, 
        duration_minutes, block_type, status, notes
    ) VALUES (
        v_request.group_id, NEW.responder_id, v_initiator_child_id,
        v_request.requested_date, v_request.start_time, v_request.end_time,
        v_duration_minutes, 'care_provided', 'confirmed', v_request.notes
    );
    
    -- 3. Parent B needs care (reciprocal)
    INSERT INTO public.scheduled_blocks (
        group_id, parent_id, child_id, scheduled_date, start_time, end_time, 
        duration_minutes, block_type, status, notes
    ) VALUES (
        v_request.group_id, NEW.responder_id, v_responder_child_id,
        v_request.requested_date, v_request.start_time, v_request.end_time,
        v_duration_minutes, 'care_needed', 'confirmed', v_request.notes
    );
    
    -- 4. Parent A provides care for Parent B's child
    INSERT INTO public.scheduled_blocks (
        group_id, parent_id, child_id, scheduled_date, start_time, end_time, 
        duration_minutes, block_type, status, notes
    ) VALUES (
        v_request.group_id, v_request.initiator_id, v_responder_child_id,
        v_request.requested_date, v_request.start_time, v_request.end_time,
        v_duration_minutes, 'care_provided', 'confirmed', v_request.notes
    );
    
    -- Close the request
    UPDATE public.babysitting_requests
    SET status = 'closed'
    WHERE id = NEW.request_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to automatically create scheduled blocks when Parent B agrees
CREATE TRIGGER create_initial_scheduled_blocks_trigger
    AFTER INSERT ON public.request_responses
    FOR EACH ROW
    EXECUTE FUNCTION create_initial_scheduled_blocks();

-- Step 6: Create function to invite group members to existing care agreement
CREATE OR REPLACE FUNCTION invite_group_members_to_care(
    p_request_id UUID,
    p_inviter_id UUID,
    p_invited_date DATE,
    p_invited_start_time TIME,
    p_invited_end_time TIME
) RETURNS VOID AS $$
DECLARE
    v_group_id UUID;
    v_invitee RECORD;
    v_duration_minutes INTEGER;
BEGIN
    -- Get the group_id from the request
    SELECT group_id INTO v_group_id
    FROM public.babysitting_requests
    WHERE id = p_request_id;
    
    -- Calculate duration
    v_duration_minutes := EXTRACT(EPOCH FROM (p_invited_end_time - p_invited_start_time)) / 60;
    
    -- Create invitations for all active group members except the inviter
    FOR v_invitee IN 
        SELECT gm.profile_id
        FROM public.group_members gm
        WHERE gm.group_id = v_group_id
        AND gm.profile_id != p_inviter_id
        AND gm.status = 'active'
    LOOP
        -- Insert invitation (ignore if already exists due to unique constraint)
        INSERT INTO public.group_invitations (
            group_id,
            inviter_id,
            invitee_id,
            request_id,
            invited_date,
            invited_start_time,
            invited_end_time,
            invited_duration_minutes,
            status
        ) VALUES (
            v_group_id,
            p_inviter_id,
            v_invitee.profile_id,
            p_request_id,
            p_invited_date,
            p_invited_start_time,
            p_invited_end_time,
            v_duration_minutes,
            'pending'
        ) ON CONFLICT (request_id, invitee_id) DO NOTHING;
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 7: Create function to accept invitation and create scheduled blocks
CREATE OR REPLACE FUNCTION accept_group_invitation(
    p_invitation_id UUID,
    p_accepting_user_id UUID
) RETURNS VOID AS $$
DECLARE
    v_invitation RECORD;
    v_request RECORD;
BEGIN
    -- Get invitation details
    SELECT * INTO v_invitation
    FROM public.group_invitations
    WHERE id = p_invitation_id AND invitee_id = p_accepting_user_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Invitation not found or not authorized';
    END IF;
    
    -- Get request details
    SELECT * INTO v_request
    FROM public.babysitting_requests
    WHERE id = v_invitation.request_id;
    
    -- Update invitation status
    UPDATE public.group_invitations
    SET status = 'accepted'
    WHERE id = p_invitation_id;
    
    -- Create scheduled blocks for the accepting user
    -- Block 1: Accepting user providing care to inviter
    INSERT INTO public.scheduled_blocks (
        group_id,
        request_id,
        parent_id,
        child_id,
        scheduled_date,
        start_time,
        end_time,
        duration_minutes,
        block_type,
        status,
        notes
    ) VALUES (
        v_invitation.group_id,
        v_invitation.request_id,
        p_accepting_user_id,
        v_request.child_id, -- Caring for the original request's child
        v_invitation.invited_date,
        v_invitation.invited_start_time,
        v_invitation.invited_end_time,
        v_invitation.invited_duration_minutes,
        'care_provided',
        'confirmed',
        'Care provided as part of group invitation'
    );
    
    -- Block 2: Accepting user needs care (reciprocal)
    INSERT INTO public.scheduled_blocks (
        group_id,
        request_id,
        parent_id,
        child_id,
        scheduled_date,
        start_time,
        end_time,
        duration_minutes,
        block_type,
        status,
        notes
    ) VALUES (
        v_invitation.group_id,
        v_invitation.request_id,
        p_accepting_user_id,
        v_request.child_id, -- Their own child needs care
        v_request.requested_date,
        v_request.start_time,
        v_request.end_time,
        v_request.duration_minutes,
        'care_needed',
        'confirmed',
        'Care needed as part of group invitation'
    );
    
    -- Create blocks for the inviter
    -- Block 3: Inviter providing care to accepting user
    INSERT INTO public.scheduled_blocks (
        group_id,
        request_id,
        parent_id,
        child_id,
        scheduled_date,
        start_time,
        end_time,
        duration_minutes,
        block_type,
        status,
        notes
    ) VALUES (
        v_invitation.group_id,
        v_invitation.request_id,
        v_invitation.inviter_id,
        v_request.child_id, -- Caring for the accepting user's child
        v_request.requested_date,
        v_request.start_time,
        v_request.end_time,
        v_request.duration_minutes,
        'care_provided',
        'confirmed',
        'Care provided as part of group invitation'
    );
    
    -- Block 4: Inviter needs care (original request)
    INSERT INTO public.scheduled_blocks (
        group_id,
        request_id,
        parent_id,
        child_id,
        scheduled_date,
        start_time,
        end_time,
        duration_minutes,
        block_type,
        status,
        notes
    ) VALUES (
        v_invitation.group_id,
        v_invitation.request_id,
        v_invitation.inviter_id,
        v_request.child_id, -- Their own child needs care
        v_invitation.invited_date,
        v_invitation.invited_start_time,
        v_invitation.invited_end_time,
        v_invitation.invited_duration_minutes,
        'care_needed',
        'confirmed',
        'Care needed as part of group invitation'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 7: Grant permissions
GRANT SELECT, INSERT, UPDATE ON public.group_invitations TO authenticated;
GRANT EXECUTE ON FUNCTION invite_group_members_to_care(UUID, UUID, DATE, TIME, TIME) TO authenticated;
GRANT EXECUTE ON FUNCTION accept_group_invitation(UUID, UUID) TO authenticated;

-- Success message
SELECT 'Scheduling system simplified successfully! Complex reciprocal care removed and new invite system added.' as status; 