-- Fix All Missing Functions
-- This script creates all the missing functions that are causing 404 errors
-- Run this in your Supabase SQL editor

-- ============================================================================
-- STEP 1: Fix get_user_children_for_group function
-- ============================================================================

DROP FUNCTION IF EXISTS get_user_children_for_group(UUID, UUID);

CREATE OR REPLACE FUNCTION get_user_children_for_group(
  p_user_id UUID,
  p_group_id UUID
)
RETURNS TABLE (
  id UUID,
  full_name TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.id,
    c.full_name
  FROM public.children c
  JOIN public.child_group_members cgm ON c.id = cgm.child_id
  WHERE c.parent_id = p_user_id
    AND cgm.group_id = p_group_id
  ORDER BY c.full_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- STEP 2: Fix get_available_time_blocks_for_invitation function
-- ============================================================================

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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- STEP 3: Fix get_children_in_care_block function (already created but ensuring it exists)
-- ============================================================================

DROP FUNCTION IF EXISTS get_children_in_care_block(UUID);

CREATE OR REPLACE FUNCTION get_children_in_care_block(
    p_care_group_id UUID
) RETURNS TABLE (
    child_id UUID,
    child_name TEXT,
    parent_name TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        c.id as child_id,
        c.full_name as child_name,
        p.full_name as parent_name
    FROM public.scheduled_blocks sb
    JOIN public.children c ON sb.child_id = c.id
    JOIN public.profiles p ON c.parent_id = p.id
    WHERE sb.care_group_id = p_care_group_id
    ORDER BY c.full_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- STEP 4: Grant permissions for all functions
-- ============================================================================

GRANT EXECUTE ON FUNCTION get_user_children_for_group(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_available_time_blocks_for_invitation(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_children_in_care_block(UUID) TO authenticated;

-- ============================================================================
-- STEP 5: Verify all functions exist
-- ============================================================================

-- Check that all required functions exist
SELECT 
    'Function Check' as test_name,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.routines 
            WHERE routine_name = 'get_user_children_for_group'
            AND routine_type = 'FUNCTION'
        ) THEN '✅ PASS: get_user_children_for_group exists'
        ELSE '❌ FAIL: get_user_children_for_group missing'
    END as status
UNION ALL
SELECT 
    'Function Check' as test_name,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.routines 
            WHERE routine_name = 'get_available_time_blocks_for_invitation'
            AND routine_type = 'FUNCTION'
        ) THEN '✅ PASS: get_available_time_blocks_for_invitation exists'
        ELSE '❌ FAIL: get_available_time_blocks_for_invitation missing'
    END as status
UNION ALL
SELECT 
    'Function Check' as test_name,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.routines 
            WHERE routine_name = 'get_children_in_care_block'
            AND routine_type = 'FUNCTION'
        ) THEN '✅ PASS: get_children_in_care_block exists'
        ELSE '❌ FAIL: get_children_in_care_block missing'
    END as status;

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================

SELECT 'All missing functions fixed! The 404 errors should now be resolved.' as status; 