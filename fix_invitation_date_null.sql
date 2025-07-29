-- Fix invitation_date null constraint error
-- This script fixes the issue where invitation_date was null due to incorrect array indexing

-- Drop and recreate the invite_specific_parents_to_care function with the fix
DROP FUNCTION IF EXISTS invite_specific_parents_to_care(UUID, UUID, UUID[], JSONB);

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

-- Grant permissions
GRANT EXECUTE ON FUNCTION invite_specific_parents_to_care(UUID, UUID, UUID[], JSONB) TO authenticated;

-- Success message
SELECT 'Fixed invitation_date null constraint error!' as status; 