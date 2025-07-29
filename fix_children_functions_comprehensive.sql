-- Comprehensive fix for children functions that works with any column structure
-- Run this in Supabase SQL editor

-- First, let's create a function that dynamically determines the child name
CREATE OR REPLACE FUNCTION get_child_display_name(child_record children)
RETURNS TEXT AS $$
DECLARE
  child_name TEXT := 'Child';
BEGIN
  -- Try different possible column combinations
  -- Check if 'name' column exists
  BEGIN
    EXECUTE 'SELECT name FROM children WHERE id = $1' INTO child_name USING child_record.id;
    IF child_name IS NOT NULL AND child_name != '' THEN
      RETURN child_name;
    END IF;
  EXCEPTION WHEN undefined_column THEN
    NULL;
  END;

  -- Check if 'first_name' and 'last_name' columns exist
  BEGIN
    EXECUTE 'SELECT COALESCE(first_name, '''') || '' '' || COALESCE(last_name, '''') FROM children WHERE id = $1' 
      INTO child_name USING child_record.id;
    IF child_name IS NOT NULL AND child_name != ' ' AND child_name != '' THEN
      RETURN TRIM(child_name);
    END IF;
  EXCEPTION WHEN undefined_column THEN
    NULL;
  END;

  -- Check if only 'first_name' exists
  BEGIN
    EXECUTE 'SELECT first_name FROM children WHERE id = $1' INTO child_name USING child_record.id;
    IF child_name IS NOT NULL AND child_name != '' THEN
      RETURN child_name;
    END IF;
  EXCEPTION WHEN undefined_column THEN
    NULL;
  END;

  -- Check if only 'last_name' exists
  BEGIN
    EXECUTE 'SELECT last_name FROM children WHERE id = $1' INTO child_name USING child_record.id;
    IF child_name IS NOT NULL AND child_name != '' THEN
      RETURN child_name;
    END IF;
  EXCEPTION WHEN undefined_column THEN
    NULL;
  END;

  -- Check if 'display_name' exists
  BEGIN
    EXECUTE 'SELECT display_name FROM children WHERE id = $1' INTO child_name USING child_record.id;
    IF child_name IS NOT NULL AND child_name != '' THEN
      RETURN child_name;
    END IF;
  EXCEPTION WHEN undefined_column THEN
    NULL;
  END;

  -- Default fallback
  RETURN 'Child';
END;
$$ LANGUAGE plpgsql;

-- Drop existing functions first
DROP FUNCTION IF EXISTS get_user_children_for_group(UUID, UUID);
DROP FUNCTION IF EXISTS get_all_children_for_group(UUID);
DROP FUNCTION IF EXISTS get_children_for_parent_in_group(UUID, UUID);

-- Function to get user's children for a specific group (works with any column structure)
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
    get_child_display_name(c.*) as child_name,
    c.parent_id,
    p.full_name as parent_name
  FROM children c
  JOIN profiles p ON c.parent_id = p.id
  JOIN child_group_members cgm ON c.id = cgm.child_id
  WHERE cgm.group_id = p_group_id
    AND c.parent_id = p_user_id
  ORDER BY child_name;
END;
$$ LANGUAGE plpgsql;

-- Function to get all children in a group (works with any column structure)
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
    get_child_display_name(c.*) as child_name,
    c.parent_id,
    p.full_name as parent_name
  FROM children c
  JOIN profiles p ON c.parent_id = p.id
  JOIN child_group_members cgm ON c.id = cgm.child_id
  WHERE cgm.group_id = p_group_id
  ORDER BY p.full_name, child_name;
END;
$$ LANGUAGE plpgsql;

-- Function to get children for a specific parent in a group (works with any column structure)
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
    get_child_display_name(c.*) as child_name,
    c.parent_id,
    p.full_name as parent_name
  FROM children c
  JOIN profiles p ON c.parent_id = p.id
  JOIN child_group_members cgm ON c.id = cgm.child_id
  WHERE cgm.group_id = p_group_id
    AND c.parent_id = p_parent_id
  ORDER BY child_name;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION get_child_display_name(children) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_children_for_group(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_all_children_for_group(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_children_for_parent_in_group(UUID, UUID) TO authenticated;