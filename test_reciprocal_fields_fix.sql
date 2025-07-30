-- Test script to verify reciprocal fields fix
-- This script tests that the reciprocal care fields are properly added and working

-- Test 1: Check if reciprocal fields exist in request_responses table
SELECT 
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'request_responses' 
            AND column_name = 'reciprocal_date'
        ) THEN '✅ PASS: reciprocal_date column exists'
        ELSE '❌ FAIL: reciprocal_date column missing'
    END as test_1;

SELECT 
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'request_responses' 
            AND column_name = 'reciprocal_start_time'
        ) THEN '✅ PASS: reciprocal_start_time column exists'
        ELSE '❌ FAIL: reciprocal_start_time column missing'
    END as test_2;

SELECT 
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'request_responses' 
            AND column_name = 'reciprocal_end_time'
        ) THEN '✅ PASS: reciprocal_end_time column exists'
        ELSE '❌ FAIL: reciprocal_end_time column missing'
    END as test_3;

SELECT 
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'request_responses' 
            AND column_name = 'reciprocal_child_id'
        ) THEN '✅ PASS: reciprocal_child_id column exists'
        ELSE '❌ FAIL: reciprocal_child_id column missing'
    END as test_4;

-- Test 2: Check if create_care_exchange function exists
SELECT 
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.routines 
            WHERE routine_name = 'create_care_exchange'
        ) THEN '✅ PASS: create_care_exchange function exists'
        ELSE '❌ FAIL: create_care_exchange function missing'
    END as test_5;

-- Test 3: Check if indexes exist
SELECT 
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM pg_indexes 
            WHERE indexname = 'idx_request_responses_reciprocal_child_id'
        ) THEN '✅ PASS: reciprocal_child_id index exists'
        ELSE '❌ FAIL: reciprocal_child_id index missing'
    END as test_6;

SELECT 
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM pg_indexes 
            WHERE indexname = 'idx_request_responses_reciprocal_date'
        ) THEN '✅ PASS: reciprocal_date index exists'
        ELSE '❌ FAIL: reciprocal_date index missing'
    END as test_7;

-- Test 4: Check constraint exists
SELECT 
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.table_constraints 
            WHERE table_name = 'request_responses' 
            AND constraint_name = 'valid_reciprocal_time_range'
        ) THEN '✅ PASS: valid_reciprocal_time_range constraint exists'
        ELSE '❌ FAIL: valid_reciprocal_time_range constraint missing'
    END as test_8;

-- Test 5: Show sample data structure (if any responses exist)
SELECT 
    'Sample response data structure:' as info,
    COUNT(*) as total_responses,
    COUNT(reciprocal_date) as responses_with_reciprocal_date,
    COUNT(reciprocal_child_id) as responses_with_reciprocal_child
FROM request_responses;

-- Test 6: Show detailed response structure
SELECT 
    id,
    request_id,
    responder_id,
    response_type,
    status,
    reciprocal_date,
    reciprocal_start_time,
    reciprocal_end_time,
    reciprocal_child_id,
    created_at
FROM request_responses 
ORDER BY created_at DESC 
LIMIT 5;

-- Success message
SELECT 'Reciprocal fields test completed! Check the results above.' as status; 