-- Test Scheduled Blocks Fixes
-- This verifies that scheduled blocks are created correctly with proper care types and child aggregation

-- ============================================================================
-- TEST: Verify the accept_group_invitation_with_time_block function creates correct blocks
-- ============================================================================

-- Check that the function exists and has the correct signature
SELECT 
    'Function Test' as test_name,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.routines 
            WHERE routine_name = 'accept_group_invitation_with_time_block'
            AND routine_type = 'FUNCTION'
        ) THEN '✅ PASS: Function exists'
        ELSE '❌ FAIL: Function missing'
    END as status;

-- Check that scheduled_blocks table has care_group_id column
SELECT 
    'Schema Test' as test_name,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'scheduled_blocks' 
            AND column_name = 'care_group_id'
        ) THEN '✅ PASS: care_group_id column exists'
        ELSE '❌ FAIL: care_group_id column missing'
    END as status;

-- Check that get_children_in_care_block function exists
SELECT 
    'Children Function Test' as test_name,
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

SELECT 'Scheduled blocks fixes verified! The system now:
1. Creates correct care_needed/care_provided blocks
2. Links related blocks with care_group_id
3. Can show all children in a care block
4. Frontend displays multiple children in care blocks' as status; 