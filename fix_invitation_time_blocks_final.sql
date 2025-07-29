-- Fix invitation time blocks to match frontend expectations
-- Run this in Supabase SQL editor

-- Drop existing functions first
DROP FUNCTION IF EXISTS get_available_time_blocks_for_invitation(UUID);
DROP FUNCTION IF EXISTS accept_group_invitation_with_time_block(UUID, UUID, INTEGER, UUID);

-- Create the correct version that matches frontend expectations
CREATE OR REPLACE FUNCTION get_available_time_blocks_for_invitation(
  p_invitation_id UUID
)
RETURNS TABLE (
  block_index INTEGER,
  block_date DATE,
  block_start_time TIME,
  block_end_time TIME,
  block_duration_minutes INTEGER,
  is_available BOOLEAN
) AS $$
DECLARE
  v_invitation group_invitations%ROWTYPE;
BEGIN
  -- Get the invitation details
  SELECT * INTO v_invitation FROM group_invitations WHERE id = p_invitation_id;
  
  IF NOT FOUND THEN
    RETURN;
  END IF;
  
  -- Return a single time block based on the invitation data
  RETURN QUERY
  SELECT 
    0 as block_index,
    v_invitation.invitation_date as block_date,
    v_invitation.invitation_start_time as block_start_time,
    v_invitation.invitation_end_time as block_end_time,
    v_invitation.invitation_duration_minutes as block_duration_minutes,
    (v_invitation.status = 'pending') as is_available;
END;
$$ LANGUAGE plpgsql;

-- Create the function to accept invitation with time block and child selection
CREATE OR REPLACE FUNCTION accept_group_invitation_with_time_block(
  p_invitation_id UUID,
  p_accepting_user_id UUID,
  p_selected_time_block_index INTEGER,
  p_selected_child_id UUID
)
RETURNS VOID AS $$
DECLARE
  v_invitation group_invitations%ROWTYPE;
  v_request babysitting_requests%ROWTYPE;
  v_duration_minutes INTEGER;
BEGIN
  -- Get the invitation details
  SELECT * INTO v_invitation FROM group_invitations WHERE id = p_invitation_id;
  
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
  SELECT * INTO v_request FROM babysitting_requests WHERE id = v_invitation.request_id;
  
  -- Calculate duration
  v_duration_minutes := v_invitation.invitation_duration_minutes;
  
  -- Update invitation status
  UPDATE group_invitations 
  SET 
    status = 'accepted',
    selected_time_block_index = p_selected_time_block_index
  WHERE id = p_invitation_id;
  
  -- Create scheduled blocks for the reciprocal arrangement
  
  -- 1. Original request: Inviter needs care, Accepting user provides care
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
    v_request.group_id,
    v_request.initiator_id,  -- Inviter needs care
    v_request.child_id,
    v_request.requested_date,
    v_request.start_time,
    v_request.end_time,
    v_request.duration_minutes,
    'care_needed',
    'confirmed',
    v_request.id,
    v_request.notes
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
    notes
  ) VALUES (
    v_request.group_id,
    p_accepting_user_id,  -- Accepting user provides care
    v_request.child_id,
    v_request.requested_date,
    v_request.start_time,
    v_request.end_time,
    v_request.duration_minutes,
    'care_provided',
    'confirmed',
    v_request.id,
    v_invitation.notes
  );
  
  -- 2. Reciprocal care: Accepting user needs care, Inviter provides care
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
    v_request.group_id,
    p_accepting_user_id,  -- Accepting user needs care
    p_selected_child_id,
    v_invitation.invitation_date,
    v_invitation.invitation_start_time,
    v_invitation.invitation_end_time,
    v_duration_minutes,
    'care_needed',
    'confirmed',
    v_request.id,
    v_invitation.notes
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
    notes
  ) VALUES (
    v_request.group_id,
    v_invitation.inviter_id,  -- Inviter provides care
    p_selected_child_id,
    v_invitation.invitation_date,
    v_invitation.invitation_start_time,
    v_invitation.invitation_end_time,
    v_duration_minutes,
    'care_provided',
    'confirmed',
    v_request.id,
    v_invitation.notes
  );
  
  RAISE NOTICE 'Successfully accepted invitation % and created scheduled blocks', p_invitation_id;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION get_available_time_blocks_for_invitation(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION accept_group_invitation_with_time_block(UUID, UUID, INTEGER, UUID) TO authenticated;