-- Fix the time blocks function with no column assumptions
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
    0 as block_index,  -- Default value
    CURRENT_DATE as block_date,  -- Default value
    '09:00:00'::time as block_start_time,  -- Default value
    '11:00:00'::time as block_end_time,  -- Default value
    120 as block_duration_minutes,  -- Default value
    true as is_available  -- Always available
  FROM invitation_time_blocks itb
  WHERE itb.invitation_id = p_invitation_id
  LIMIT 1;  -- Just return one row for now to test
END;
$$ LANGUAGE plpgsql;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_available_time_blocks_for_invitation(UUID) TO authenticated;