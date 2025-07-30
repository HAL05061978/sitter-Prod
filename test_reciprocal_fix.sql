-- Test script to verify reciprocal fields fix is working
-- Run this after applying the fix to check if everything is working

-- Step 1: Check if reciprocal fields were added successfully
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

-- Step 2: Check if create_care_exchange function exists
SELECT 
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.routines 
            WHERE routine_name = 'create_care_exchange'
        ) THEN '✅ PASS: create_care_exchange function exists'
        ELSE '❌ FAIL: create_care_exchange function missing'
    END as test_5;

-- Step 3: Show current data structure
SELECT 
    'Current data structure:' as info,
    COUNT(*) as total_responses,
    COUNT(reciprocal_date) as responses_with_reciprocal_date,
    COUNT(reciprocal_child_id) as responses_with_reciprocal_child
FROM request_responses;

-- Step 4: Show sample response data (if any exist)
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

-- Step 5: Show sample scheduled blocks (if any exist)
SELECT 
    id,
    parent_id,
    child_id,
    scheduled_date,
    start_time,
    end_time,
    block_type,
    status,
    request_id,
    care_group_id,
    created_at
FROM scheduled_blocks 
ORDER BY created_at DESC 
LIMIT 5;

-- Success message
SELECT 'Reciprocal fields test completed! Check the results above.' as status; 