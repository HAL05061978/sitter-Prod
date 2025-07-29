-- Create the missing invitation functions
-- Run this in Supabase SQL editor

-- Function to get available group members for invitation (excluding Parent A)
CREATE OR REPLACE FUNCTION get_available_group_members_for_invitation(
  p_group_id UUID,
  p_initiator_id UUID
)
RETURNS TABLE (
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
  FROM profiles p
  JOIN group_members gm ON p.id = gm.profile_id
  WHERE gm.group_id = p_group_id
    AND p.id != p_initiator_id  -- Exclude Parent A (the original requester)
    AND p.id IN (
      -- Only include members who have children in the group
      SELECT DISTINCT c.parent_id 
      FROM children c
      JOIN group_members gm2 ON c.id = gm2.child_id
      WHERE gm2.group_id = p_group_id
    );
END;
$$ LANGUAGE plpgsql;

-- Function to invite specific parents to care
CREATE OR REPLACE FUNCTION invite_specific_parents_to_care(
  p_request_id UUID,
  p_inviter_id UUID,
  p_invitation_date DATE,
  p_invitation_start_time TIME,
  p_invitation_end_time TIME,
  p_invitation_duration_minutes INTEGER,
  p_selected_parents UUID[],
  p_notes TEXT DEFAULT NULL
)
RETURNS VOID AS $$
DECLARE
  v_parent_id UUID;
  v_invitation_id UUID;
BEGIN
  -- Create invitations for each selected parent
  FOREACH v_parent_id IN ARRAY p_selected_parents
  LOOP
    -- Generate a unique invitation ID
    v_invitation_id := gen_random_uuid();
    
    -- Insert the invitation
    INSERT INTO group_invitations (
      id,
      group_id,
      inviter_id,
      invitee_id,
      request_id,
      invitation_date,
      invitation_start_time,
      invitation_end_time,
      invitation_duration_minutes,
      status,
      notes,
      created_at
    ) VALUES (
      v_invitation_id,
      (SELECT group_id FROM babysitting_requests WHERE id = p_request_id),
      p_inviter_id,
      v_parent_id,
      p_request_id,
      p_invitation_date,
      p_invitation_start_time,
      p_invitation_end_time,
      p_invitation_duration_minutes,
      'pending',
      p_notes,
      NOW()
    );
    
    RAISE NOTICE 'Created invitation % for parent %', v_invitation_id, v_parent_id;
  END LOOP;
  
  RAISE NOTICE 'Successfully created % invitations for request %', array_length(p_selected_parents, 1), p_request_id;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION get_available_group_members_for_invitation(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION invite_specific_parents_to_care(UUID, UUID, DATE, TIME, TIME, INTEGER, UUID[], TEXT) TO authenticated;