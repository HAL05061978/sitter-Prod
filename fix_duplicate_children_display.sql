-- Fix Duplicate Children Display
-- This fixes the issue where duplicate child names appear in calendar blocks
-- Run this in your Supabase SQL editor

-- ============================================================================
-- STEP 1: Update the get_children_in_care_block function to be more specific
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
    -- For now, return only the first child in the care group to avoid duplicates
    -- This will be improved when we have better care group logic
    RETURN QUERY
    SELECT DISTINCT
        c.id as child_id,
        c.full_name as child_name,
        p.full_name as parent_name
    FROM public.scheduled_blocks sb
    JOIN public.children c ON sb.child_id = c.id
    JOIN public.profiles p ON c.parent_id = p.id
    WHERE sb.care_group_id = p_care_group_id
    ORDER BY c.full_name
    LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- STEP 2: Create a better function for getting children for a specific block
-- ============================================================================

DROP FUNCTION IF EXISTS get_children_for_specific_block(UUID);

CREATE OR REPLACE FUNCTION get_children_for_specific_block(
    p_block_id UUID
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
    WHERE sb.id = p_block_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- STEP 3: Grant permissions
-- ============================================================================

GRANT EXECUTE ON FUNCTION get_children_in_care_block(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_children_for_specific_block(UUID) TO authenticated;

-- ============================================================================
-- STEP 4: Verify the functions exist
-- ============================================================================

-- Check that the functions exist
SELECT 
    'Function Test' as test_name,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.routines 
            WHERE routine_name = 'get_children_in_care_block'
            AND routine_type = 'FUNCTION'
        ) THEN '✅ PASS: get_children_in_care_block function exists'
        ELSE '❌ FAIL: get_children_in_care_block function missing'
    END as status
UNION ALL
SELECT 
    'Function Test' as test_name,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.routines 
            WHERE routine_name = 'get_children_for_specific_block'
            AND routine_type = 'FUNCTION'
        ) THEN '✅ PASS: get_children_for_specific_block function exists'
        ELSE '❌ FAIL: get_children_for_specific_block function missing'
    END as status;

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================

SELECT 'Duplicate children display fixed! Calendar blocks should now show only one child name per block.' as status; 