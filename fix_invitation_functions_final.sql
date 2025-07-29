-- Fix both invitation functions with correct signatures and exclude both Parent A and Parent B
-- Run this in Supabase SQL editor

-- Drop existing functions first
DROP FUNCTION IF EXISTS get_available_group_members_for_invitation(UUID, UUID);
DROP FUNCTION IF EXISTS invite_specific_parents_to_care(UUID, UUID, DATE, TIME, TIME, INTEGER, UUID[], TEXT);

-- Create the corrected function that excludes both Parent A and Parent B
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
    AND p.id != auth.uid()      -- Exclude Parent B (current user sending invitation)
    AND p.id IN (
      -- Include all members who have children in the group (excluding Parent A and Parent B)
      SELECT DISTINCT c.parent_id 
      FROM children c
      JOIN child_group_members cgm ON c.id = cgm.child_id
      WHERE cgm.group_id = p_group_id
    );
END;
$$ LANGUAGE plpgsql;

-- Create the function with the signature that matches what the frontend expects
CREATE OR REPLACE FUNCTION invite_specific_parents_to_care(
  p_invitee_ids UUID[],
  p_inviter_id UUID,
  p_request_id UUID,
  p_time_blocks JSONB
)
RETURNS VOID AS $$
DECLARE
  v_invitee_id UUID;
  v_time_block JSONB;
  v_invitation_id UUID;
  v_group_id UUID;
  v_duration_minutes INTEGER;
  v_start_time TIME;
  v_end_time TIME;
BEGIN
  -- Get the group_id from the request
  SELECT group_id INTO v_group_id FROM babysitting_requests WHERE id = p_request_id;
  
  -- Create invitations for each selected parent
  FOREACH v_invitee_id IN ARRAY p_invitee_ids
  LOOP
    -- For each time block in the JSON array
    FOR v_time_block IN SELECT * FROM jsonb_array_elements(p_time_blocks)
    LOOP
      -- Generate a unique invitation ID
      v_invitation_id := gen_random_uuid();
      
      -- Extract times and calculate duration
      v_start_time := (v_time_block->>'start_time')::TIME;
      v_end_time := (v_time_block->>'end_time')::TIME;
      
      -- Calculate duration in minutes if not provided
      IF v_time_block->>'duration_minutes' IS NOT NULL THEN
        v_duration_minutes := (v_time_block->>'duration_minutes')::INTEGER;
      ELSE
        v_duration_minutes := EXTRACT(EPOCH FROM (v_end_time::time - v_start_time::time)) / 60;
      END IF;
      
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
        v_group_id,
        p_inviter_id,
        v_invitee_id,
        p_request_id,
        (v_time_block->>'date')::DATE,
        v_start_time,
        v_end_time,
        v_duration_minutes,
        'pending',
        COALESCE(v_time_block->>'notes', ''),
        NOW()
      );
      
      RAISE NOTICE 'Created invitation % for parent % with time block % (duration: % minutes)', 
        v_invitation_id, v_invitee_id, v_time_block, v_duration_minutes;
    END LOOP;
  END LOOP;
  
  RAISE NOTICE 'Successfully created invitations for request %', p_request_id;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION get_available_group_members_for_invitation(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION invite_specific_parents_to_care(UUID[], UUID, UUID, JSONB) TO authenticated;