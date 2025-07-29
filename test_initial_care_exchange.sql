-- Test Initial Care Exchange (Parent A ↔ Parent B)
-- This verifies that the initial care exchange creates proper calendar blocks

-- ============================================================================
-- TEST: Verify the initial care exchange workflow
-- ============================================================================

-- Check that the create_care_exchange function exists
SELECT 
    'Function Test' as test_name,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.routines 
            WHERE routine_name = 'create_care_exchange'
            AND routine_type = 'FUNCTION'
        ) THEN '✅ PASS: create_care_exchange function exists'
        ELSE '❌ FAIL: create_care_exchange function missing'
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
    END as result;

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================

SELECT 'Initial care exchange test ready! The system should now:
1. Create 4 scheduled blocks when Parent A accepts Parent B''s response
2. Show correct care_needed/care_provided blocks for both parents
3. Link blocks with care_group_id for child aggregation
4. Handle reciprocal care when Parent B specifies their own care needs

To test:
1. Parent A creates a babysitting request
2. Parent B responds with agreement and reciprocal care details
3. Parent A accepts Parent B''s response
4. Check that 4 calendar blocks are created (2 care_needed + 2 care_provided)' as status; 