-- Fix Invitation Auto-Accept Bug
-- This changes the invitation flow to create proposals instead of automatic acceptance
-- The correct flow should be: Parent A invites → Parent B accepts (creates proposal) → Parent A chooses proposal

-- ============================================================================
-- STEP 1: Create a new table for invitation proposals
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.invitation_proposals (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    invitation_id UUID NOT NULL REFERENCES public.group_invitations(id) ON DELETE CASCADE,
    proposer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    selected_time_block_index INTEGER NOT NULL,
    selected_child_id UUID NOT NULL REFERENCES public.children(id) ON DELETE CASCADE,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    accepted_at TIMESTAMP WITH TIME ZONE,
    accepted_by UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    notes TEXT
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_invitation_proposals_invitation_id ON public.invitation_proposals(invitation_id);
CREATE INDEX IF NOT EXISTS idx_invitation_proposals_proposer_id ON public.invitation_proposals(proposer_id);
CREATE INDEX IF NOT EXISTS idx_invitation_proposals_status ON public.invitation_proposals(status);

-- Grant permissions
GRANT ALL ON public.invitation_proposals TO authenticated;
GRANT USAGE ON SEQUENCE public.invitation_proposals_id_seq TO authenticated;

-- ============================================================================
-- STEP 2: Create function to submit invitation proposal
-- ============================================================================

CREATE OR REPLACE FUNCTION submit_invitation_proposal(
    p_accepting_user_id UUID,
    p_invitation_id UUID,
    p_selected_time_block_index INTEGER,
    p_selected_child_id UUID,
    p_notes TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_invitation group_invitations%ROWTYPE;
    v_proposal_id UUID;
BEGIN
    -- Get the invitation details
    SELECT * INTO v_invitation FROM group_invitations WHERE id = p_invitation_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Invitation not found';
    END IF;
    
    -- Validate that the invitation is pending
    IF v_invitation.status != 'pending' THEN
        RAISE EXCEPTION 'Invitation is not pending';
    END IF;
    
    -- Validate that the accepting user is the invitee
    IF v_invitation.invitee_id != p_accepting_user_id THEN
        RAISE EXCEPTION 'You can only submit proposals for invitations sent to you';
    END IF;
    
    -- Validate that the selected child belongs to the accepting user
    IF NOT EXISTS (
        SELECT 1 FROM children 
        WHERE id = p_selected_child_id 
        AND parent_id = p_accepting_user_id
    ) THEN
        RAISE EXCEPTION 'Selected child does not belong to the accepting user';
    END IF;
    
    -- Check if a proposal already exists for this invitation and user
    IF EXISTS (
        SELECT 1 FROM invitation_proposals 
        WHERE invitation_id = p_invitation_id 
        AND proposer_id = p_accepting_user_id
    ) THEN
        RAISE EXCEPTION 'You have already submitted a proposal for this invitation';
    END IF;
    
    -- Create the proposal
    INSERT INTO invitation_proposals (
        invitation_id,
        proposer_id,
        selected_time_block_index,
        selected_child_id,
        notes
    ) VALUES (
        p_invitation_id,
        p_accepting_user_id,
        p_selected_time_block_index,
        p_selected_child_id,
        p_notes
    ) RETURNING id INTO v_proposal_id;
    
    RAISE NOTICE 'Successfully created proposal % for invitation %', v_proposal_id, p_invitation_id;
    
    RETURN v_proposal_id;
END;
$$;

GRANT EXECUTE ON FUNCTION submit_invitation_proposal(UUID, UUID, INTEGER, UUID, TEXT) TO authenticated;

-- ============================================================================
-- STEP 3: Create function to accept invitation proposal
-- ============================================================================

CREATE OR REPLACE FUNCTION accept_invitation_proposal(
    p_proposal_id UUID,
    p_acceptor_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_proposal invitation_proposals%ROWTYPE;
    v_invitation group_invitations%ROWTYPE;
    v_request babysitting_requests%ROWTYPE;
    v_duration_minutes INTEGER;
    v_existing_care_group_id UUID;
    v_inviter_child_id UUID;
    v_original_care_provider_id UUID;
    v_original_care_provider_child_id UUID;
BEGIN
    -- Get the proposal details
    SELECT * INTO v_proposal FROM invitation_proposals WHERE id = p_proposal_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Proposal not found';
    END IF;
    
    -- Get the invitation details
    SELECT * INTO v_invitation FROM group_invitations WHERE id = v_proposal.invitation_id;
    
    -- Get the original request details
    SELECT * INTO v_request FROM babysitting_requests WHERE id = v_invitation.request_id;
    
    -- Validate that the acceptor is the original inviter
    IF v_invitation.inviter_id != p_acceptor_id THEN
        RAISE EXCEPTION 'Only the original inviter can accept proposals';
    END IF;
    
    -- Validate that the proposal is pending
    IF v_proposal.status != 'pending' THEN
        RAISE EXCEPTION 'Proposal is not pending';
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
    
    -- 1. Parent C (proposer) needs care for their child on the ORIGINAL time slot
    INSERT INTO scheduled_blocks (
        group_id, parent_id, child_id, scheduled_date, start_time, end_time, 
        duration_minutes, block_type, status, request_id, notes, care_group_id
    ) VALUES (
        v_invitation.group_id, v_proposal.proposer_id, v_proposal.selected_child_id,
        v_request.requested_date, v_request.start_time, v_request.end_time,
        v_request.duration_minutes, 'care_needed', 'confirmed', v_request.id, 
        'Added via accepted invitation proposal', v_existing_care_group_id
    );
    
    -- 2. Parent C (proposer) provides care for Parent B's child on the INVITATION time slot
    INSERT INTO scheduled_blocks (
        group_id, parent_id, child_id, scheduled_date, start_time, end_time, 
        duration_minutes, block_type, status, request_id, notes, care_group_id
    ) VALUES (
        v_invitation.group_id, v_proposal.proposer_id, v_inviter_child_id,
        v_invitation.invitation_date, v_invitation.invitation_start_time, v_invitation.invitation_end_time,
        v_duration_minutes, 'care_provided', 'confirmed', v_request.id, 
        'Reciprocal care via accepted invitation proposal', v_existing_care_group_id
    );
    
    -- Mark proposal as accepted
    UPDATE invitation_proposals 
    SET status = 'accepted',
        accepted_at = NOW(),
        accepted_by = p_acceptor_id
    WHERE id = p_proposal_id;
    
    -- Mark invitation as accepted
    UPDATE group_invitations 
    SET status = 'accepted',
        selected_time_block_index = v_proposal.selected_time_block_index
    WHERE id = v_invitation.id;
    
    -- Reject all other pending proposals for this invitation
    UPDATE invitation_proposals 
    SET status = 'rejected'
    WHERE invitation_id = v_invitation.id 
    AND id != p_proposal_id 
    AND status = 'pending';
    
    RAISE NOTICE 'Successfully accepted proposal % for invitation %. Created care blocks for Parent C child % and Parent B child %', 
        p_proposal_id, v_invitation.id, v_proposal.selected_child_id, v_inviter_child_id;
END;
$$;

GRANT EXECUTE ON FUNCTION accept_invitation_proposal(UUID, UUID) TO authenticated;

-- ============================================================================
-- STEP 4: Create function to get proposals for an invitation
-- ============================================================================

CREATE OR REPLACE FUNCTION get_invitation_proposals(p_invitation_id UUID)
RETURNS TABLE (
    id UUID,
    proposer_id UUID,
    proposer_name TEXT,
    selected_time_block_index INTEGER,
    selected_child_name TEXT,
    status VARCHAR(20),
    created_at TIMESTAMP WITH TIME ZONE,
    accepted_at TIMESTAMP WITH TIME ZONE,
    accepted_by UUID,
    notes TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ip.id,
        ip.proposer_id,
        p.full_name as proposer_name,
        ip.selected_time_block_index,
        c.full_name as selected_child_name,
        ip.status,
        ip.created_at,
        ip.accepted_at,
        ip.accepted_by,
        ip.notes
    FROM invitation_proposals ip
    JOIN profiles p ON ip.proposer_id = p.id
    JOIN children c ON ip.selected_child_id = c.id
    WHERE ip.invitation_id = p_invitation_id
    ORDER BY ip.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION get_invitation_proposals(UUID) TO authenticated;

-- ============================================================================
-- STEP 5: Update the old accept_group_invitation_with_time_block function
-- ============================================================================

-- This function is now deprecated - it should not be used directly
-- Instead, use submit_invitation_proposal and accept_invitation_proposal

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
BEGIN
    -- This function is deprecated - use submit_invitation_proposal instead
    RAISE EXCEPTION 'This function is deprecated. Use submit_invitation_proposal instead to create a proposal, then accept_invitation_proposal to accept it.';
END;
$$;

-- ============================================================================
-- STEP 6: Verification queries
-- ============================================================================

SELECT 
    'Function Check' as test_name,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.routines 
            WHERE routine_name = 'submit_invitation_proposal'
            AND routine_type = 'FUNCTION'
        ) THEN '✅ PASS: submit_invitation_proposal exists'
        ELSE '❌ FAIL: submit_invitation_proposal missing'
    END as status;

SELECT 
    'Function Check' as test_name,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.routines 
            WHERE routine_name = 'accept_invitation_proposal'
            AND routine_type = 'FUNCTION'
        ) THEN '✅ PASS: accept_invitation_proposal exists'
        ELSE '❌ FAIL: accept_invitation_proposal missing'
    END as status;

SELECT 
    'Table Check' as test_name,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_name = 'invitation_proposals'
            AND table_schema = 'public'
        ) THEN '✅ PASS: invitation_proposals table exists'
        ELSE '❌ FAIL: invitation_proposals table missing'
    END as status;

SELECT 'Invitation flow has been fixed to use proposals instead of auto-acceptance.' as note; 