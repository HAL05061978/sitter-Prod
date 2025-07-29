-- Create the missing invitation functions
-- Run this in Supabase SQL editor

-- Function to get available time blocks for an invitation
CREATE OR REPLACE FUNCTION get_available_time_blocks_for_invitation(
  p_invitation_id UUID
)
RETURNS TABLE (
  invitation_id UUID,
  invitation_date DATE,
  invitation_start_time TIME,
  invitation_end_time TIME,
  invitation_duration_minutes INTEGER,
  notes TEXT,
  status TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    gi.id as invitation_id,
    gi.invitation_date,
    gi.invitation_start_time,
    gi.invitation_end_time,
    gi.invitation_duration_minutes,
    gi.notes,
    gi.status
  FROM group_invitations gi
  WHERE gi.id = p_invitation_id
    AND gi.status = 'pending';
END;
$$ LANGUAGE plpgsql;

-- Function to accept an invitation
CREATE OR REPLACE FUNCTION accept_invitation(
  p_invitation_id UUID,
  p_accepted_time_block_index INTEGER DEFAULT 0
)
RETURNS VOID AS $$
DECLARE
  v_invitation group_invitations%ROWTYPE;
  v_group_id UUID;
  v_inviter_id UUID;
  v_invitee_id UUID;
  v_request_id UUID;
BEGIN
  -- Get the invitation details
  SELECT * INTO v_invitation FROM group_invitations WHERE id = p_invitation_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invitation not found';
  END IF;
  
  IF v_invitation.status != 'pending' THEN
    RAISE EXCEPTION 'Invitation is not pending';
  END IF;
  
  -- Update the invitation status
  UPDATE group_invitations 
  SET 
    status = 'accepted',
    selected_time_block_index = p_accepted_time_block_index
  WHERE id = p_invitation_id;
  
  -- Create a scheduled block for the accepted invitation
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
    notes
  ) VALUES (
    v_invitation.group_id,
    v_invitation.invitee_id,  -- The person accepting the invitation
    (SELECT c.id FROM children c WHERE c.parent_id = v_invitation.invitee_id LIMIT 1), -- Their child
    v_invitation.invitation_date,
    v_invitation.invitation_start_time,
    v_invitation.invitation_end_time,
    v_invitation.invitation_duration_minutes,
    'care_needed',
    'confirmed',
    v_invitation.request_id,
    v_invitation.notes
  );
  
  -- Create a corresponding care provided block for the inviter
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
    notes
  ) VALUES (
    v_invitation.group_id,
    v_invitation.inviter_id,  -- The person who sent the invitation
    (SELECT c.id FROM children c WHERE c.parent_id = v_invitation.inviter_id LIMIT 1), -- Their child
    v_invitation.invitation_date,
    v_invitation.invitation_start_time,
    v_invitation.invitation_end_time,
    v_invitation.invitation_duration_minutes,
    'care_provided',
    'confirmed',
    v_invitation.request_id,
    v_invitation.notes
  );
  
  RAISE NOTICE 'Successfully accepted invitation % and created scheduled blocks', p_invitation_id;
END;
$$ LANGUAGE plpgsql;

-- Function to decline an invitation
CREATE OR REPLACE FUNCTION decline_invitation(
  p_invitation_id UUID
)
RETURNS VOID AS $$
BEGIN
  UPDATE group_invitations 
  SET status = 'declined'
  WHERE id = p_invitation_id;
  
  RAISE NOTICE 'Successfully declined invitation %', p_invitation_id;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION get_available_time_blocks_for_invitation(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION accept_invitation(UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION decline_invitation(UUID) TO authenticated;