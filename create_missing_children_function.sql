-- Create the missing get_user_children_for_group function
-- Run this in Supabase SQL editor

-- Function to get user's children for a specific group
CREATE OR REPLACE FUNCTION get_user_children_for_group(
  p_group_id UUID,
  p_user_id UUID
)
RETURNS TABLE (
  child_id UUID,
  child_name TEXT,
  parent_id UUID,
  parent_name TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.id as child_id,
    c.name as child_name,
    c.parent_id,
    p.full_name as parent_name
  FROM children c
  JOIN profiles p ON c.parent_id = p.id
  JOIN child_group_members cgm ON c.id = cgm.child_id
  WHERE cgm.group_id = p_group_id
    AND c.parent_id = p_user_id
  ORDER BY c.name;
END;
$$ LANGUAGE plpgsql;

-- Function to get all children in a group (for invitation purposes)
CREATE OR REPLACE FUNCTION get_all_children_for_group(
  p_group_id UUID
)
RETURNS TABLE (
  child_id UUID,
  child_name TEXT,
  parent_id UUID,
  parent_name TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.id as child_id,
    c.name as child_name,
    c.parent_id,
    p.full_name as parent_name
  FROM children c
  JOIN profiles p ON c.parent_id = p.id
  JOIN child_group_members cgm ON c.id = cgm.child_id
  WHERE cgm.group_id = p_group_id
  ORDER BY p.full_name, c.name;
END;
$$ LANGUAGE plpgsql;

-- Function to get children for a specific parent in a group
CREATE OR REPLACE FUNCTION get_children_for_parent_in_group(
  p_group_id UUID,
  p_parent_id UUID
)
RETURNS TABLE (
  child_id UUID,
  child_name TEXT,
  parent_id UUID,
  parent_name TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.id as child_id,
    c.name as child_name,
    c.parent_id,
    p.full_name as parent_name
  FROM children c
  JOIN profiles p ON c.parent_id = p.id
  JOIN child_group_members cgm ON c.id = cgm.child_id
  WHERE cgm.group_id = p_group_id
    AND c.parent_id = p_parent_id
  ORDER BY c.name;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION get_user_children_for_group(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_all_children_for_group(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_children_for_parent_in_group(UUID, UUID) TO authenticated;