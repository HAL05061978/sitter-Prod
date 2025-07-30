-- Debug script to check reciprocal care data
-- This will help us understand what's happening with the dates

-- Check if reciprocal fields exist
SELECT 
    'Checking reciprocal fields:' as info,
    COUNT(*) as total_responses,
    COUNT(reciprocal_date) as responses_with_reciprocal_date,
    COUNT(reciprocal_start_time) as responses_with_reciprocal_start_time,
    COUNT(reciprocal_end_time) as responses_with_reciprocal_end_time,
    COUNT(reciprocal_child_id) as responses_with_reciprocal_child_id
FROM request_responses;

-- Show recent responses with their reciprocal data
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
LIMIT 10;

-- Check if there are any scheduled blocks with wrong dates
SELECT 
    'Checking scheduled blocks:' as info,
    COUNT(*) as total_blocks,
    COUNT(CASE WHEN block_type = 'care_needed' THEN 1 END) as care_needed_blocks,
    COUNT(CASE WHEN block_type = 'care_provided' THEN 1 END) as care_provided_blocks,
    MIN(scheduled_date) as earliest_date,
    MAX(scheduled_date) as latest_date
FROM scheduled_blocks;

-- Show recent scheduled blocks with their details
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
LIMIT 10;

-- Check if the create_care_exchange function exists and its definition
SELECT 
    routine_name,
    routine_definition
FROM information_schema.routines 
WHERE routine_name = 'create_care_exchange';

-- Test the function with a sample response (if any exist)
DO $$
DECLARE
    v_response_id UUID;
    v_request_id UUID;
BEGIN
    -- Get a recent response
    SELECT id, request_id INTO v_response_id, v_request_id
    FROM request_responses 
    WHERE response_type = 'agree' 
    AND reciprocal_date IS NOT NULL
    ORDER BY created_at DESC 
    LIMIT 1;
    
    IF v_response_id IS NOT NULL THEN
        RAISE NOTICE 'Testing create_care_exchange with response % and request %', v_response_id, v_request_id;
        
        -- Call the function
        PERFORM create_care_exchange(v_request_id, v_response_id);
        
        RAISE NOTICE 'Function executed successfully';
    ELSE
        RAISE NOTICE 'No suitable response found for testing';
    END IF;
END $$;

-- Show the results after function execution
SELECT 
    'After function execution:' as info,
    COUNT(*) as total_blocks,
    COUNT(CASE WHEN block_type = 'care_needed' THEN 1 END) as care_needed_blocks,
    COUNT(CASE WHEN block_type = 'care_provided' THEN 1 END) as care_provided_blocks
FROM scheduled_blocks; 