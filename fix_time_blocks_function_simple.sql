-- Fix the time blocks function to work with any column structure
-- Run this in Supabase SQL editor

-- Drop and recreate the function to ensure correct structure
DROP FUNCTION IF EXISTS get_available_time_blocks_for_invitation(UUID);

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
BEGIN
  RETURN QUERY
  SELECT 
    itb.block_index,
    itb.block_date,
    itb.block_start_time,
    itb.block_end_time,
    itb.block_duration_minutes,
    COALESCE(itb.is_available, true) as is_available  -- Default to true if column doesn't exist
  FROM invitation_time_blocks itb
  WHERE itb.invitation_id = p_invitation_id
  ORDER BY itb.block_index;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_available_time_blocks_for_invitation(UUID) TO authenticated;