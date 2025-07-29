-- Fix the invitation function to use correct table structure
-- Run this in Supabase SQL editor

-- Drop the existing function first
DROP FUNCTION IF EXISTS get_available_group_members_for_invitation(UUID, UUID);

-- Create the corrected function
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
      JOIN child_group_members cgm ON c.id = cgm.child_id
      WHERE cgm.group_id = p_group_id
    );
END;
$$ LANGUAGE plpgsql;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION get_available_group_members_for_invitation(UUID, UUID) TO authenticated;