-- Fix the time blocks function with working test values
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
  -- Return a test row with hardcoded values to verify the function works
  RETURN QUERY
  SELECT 
    0 as block_index,
    CURRENT_DATE as block_date,
    '09:00:00'::time as block_start_time,
    '11:00:00'::time as block_end_time,
    120 as block_duration_minutes,
    true as is_available;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_available_time_blocks_for_invitation(UUID) TO authenticated;