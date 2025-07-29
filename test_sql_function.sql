-- Test script to verify the SQL function is working correctly
-- Run this in Supabase SQL editor

-- First, let's check if the function exists and what version it is
SELECT 
  proname as function_name,
  prosrc as function_source
FROM pg_proc 
WHERE proname = 'select_response_and_reject_others';

-- Let's also check the current function definition
\df select_response_and_reject_others;

-- Now let's manually test the block creation logic
-- First, get a recent accepted response with reciprocal data
WITH recent_response AS (
  SELECT 
    rr.id as response_id,
    rr.request_id,
    rr.reciprocal_date,
    rr.reciprocal_start_time,
    rr.reciprocal_end_time,
    rr.reciprocal_child_id,
    br.requested_date as original_date,
    br.start_time as original_start_time,
    br.end_time as original_end_time,
    br.child_id as original_child_id
  FROM request_responses rr
  JOIN babysitting_requests br ON rr.request_id = br.id
  WHERE rr.response_type = 'agree' 
    AND rr.status = 'accepted'
    AND rr.reciprocal_date IS NOT NULL
  ORDER BY rr.created_at DESC
  LIMIT 1
)
SELECT 
  'Original Request' as block_type,
  original_date as scheduled_date,
  original_start_time as start_time,
  original_end_time as end_time,
  original_child_id as child_id
FROM recent_response
UNION ALL
SELECT 
  'Reciprocal Care' as block_type,
  reciprocal_date as scheduled_date,
  reciprocal_start_time as start_time,
  reciprocal_end_time as end_time,
  reciprocal_child_id as child_id
FROM recent_response;