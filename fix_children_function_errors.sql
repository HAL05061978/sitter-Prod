-- Fix Children Function Errors
-- This fixes the 404 errors for get_children_in_care_block function
-- Run this in your Supabase SQL editor

-- ============================================================================
-- STEP 1: Create the get_children_in_care_block function
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
-- STEP 2: Grant permissions
-- ============================================================================

GRANT EXECUTE ON FUNCTION get_children_in_care_block(UUID) TO authenticated;

-- ============================================================================
-- STEP 3: Verify the function exists
-- ============================================================================

-- Check that the function exists
SELECT 
    'Function Test' as test_name,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.routines 
            WHERE routine_name = 'get_children_in_care_block'
            AND routine_type = 'FUNCTION'
        ) THEN '✅ PASS: get_children_in_care_block function exists'
        ELSE '❌ FAIL: get_children_in_care_block function missing'
    END as status;

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================

SELECT 'Children function fixed! The 404 errors should now be resolved.' as status; 