-- Fix children functions with simple approach
-- Run this in Supabase SQL editor

-- Drop existing functions first
DROP FUNCTION IF EXISTS get_user_children_for_group(UUID, UUID);
DROP FUNCTION IF EXISTS get_all_children_for_group(UUID);
DROP FUNCTION IF EXISTS get_children_for_parent_in_group(UUID, UUID);

-- Function to get user's children for a specific group (simple approach)
CREATE OR REPLACE FUNCTION get_user_children_for_group(
  p_group_id UUID,
  p_user_id UUID
)
RETURNS TABLE (
  id UUID,
  full_name TEXT,
  parent_id UUID
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.id,
    COALESCE(
      CASE 
        WHEN c.first_name IS NOT NULL AND c.last_name IS NOT NULL THEN c.first_name || ' ' || c.last_name
        WHEN c.first_name IS NOT NULL THEN c.first_name
        WHEN c.last_name IS NOT NULL THEN c.last_name
        ELSE 'Child ' || c.id::text
      END,
      'Child ' || c.id::text
    ) as full_name,
    c.parent_id
  FROM children c
  JOIN child_group_members cgm ON c.id = cgm.child_id
  WHERE cgm.group_id = p_group_id
    AND c.parent_id = p_user_id
  ORDER BY full_name;
END;
$$ LANGUAGE plpgsql;

-- Function to get all children in a group (simple approach)
CREATE OR REPLACE FUNCTION get_all_children_for_group(
  p_group_id UUID
)
RETURNS TABLE (
  id UUID,
  full_name TEXT,
  parent_id UUID
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.id,
    COALESCE(
      CASE 
        WHEN c.first_name IS NOT NULL AND c.last_name IS NOT NULL THEN c.first_name || ' ' || c.last_name
        WHEN c.first_name IS NOT NULL THEN c.first_name
        WHEN c.last_name IS NOT NULL THEN c.last_name
        ELSE 'Child ' || c.id::text
      END,
      'Child ' || c.id::text
    ) as full_name,
    c.parent_id
  FROM children c
  JOIN child_group_members cgm ON c.id = cgm.child_id
  WHERE cgm.group_id = p_group_id
  ORDER BY full_name;
END;
$$ LANGUAGE plpgsql;

-- Function to get children for a specific parent in a group (simple approach)
CREATE OR REPLACE FUNCTION get_children_for_parent_in_group(
  p_group_id UUID,
  p_parent_id UUID
)
RETURNS TABLE (
  id UUID,
  full_name TEXT,
  parent_id UUID
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.id,
    COALESCE(
      CASE 
        WHEN c.first_name IS NOT NULL AND c.last_name IS NOT NULL THEN c.first_name || ' ' || c.last_name
        WHEN c.first_name IS NOT NULL THEN c.first_name
        WHEN c.last_name IS NOT NULL THEN c.last_name
        ELSE 'Child ' || c.id::text
      END,
      'Child ' || c.id::text
    ) as full_name,
    c.parent_id
  FROM children c
  JOIN child_group_members cgm ON c.id = cgm.child_id
  WHERE cgm.group_id = p_group_id
    AND c.parent_id = p_parent_id
  ORDER BY full_name;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION get_user_children_for_group(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_all_children_for_group(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_children_for_parent_in_group(UUID, UUID) TO authenticated;