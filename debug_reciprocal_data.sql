-- Debug script to check if reciprocal data is being saved correctly
-- Run this in Supabase SQL editor

-- Check the most recent request_responses with reciprocal data
SELECT 
  rr.id,
  rr.request_id,
  rr.responder_id,
  rr.response_type,
  rr.status,
  rr.reciprocal_date,
  rr.reciprocal_start_time,
  rr.reciprocal_end_time,
  rr.reciprocal_child_id,
  rr.reciprocal_duration_minutes,
  p.full_name as responder_name,
  c.full_name as reciprocal_child_name,
  br.requested_date as original_request_date,
  br.start_time as original_start_time,
  br.end_time as original_end_time
FROM request_responses rr
LEFT JOIN profiles p ON rr.responder_id = p.id
LEFT JOIN children c ON rr.reciprocal_child_id = c.id
LEFT JOIN babysitting_requests br ON rr.request_id = br.id
WHERE rr.response_type = 'agree' 
  AND rr.status = 'accepted'
ORDER BY rr.created_at DESC
LIMIT 5;

-- Check if there are any request_responses with NULL reciprocal data
SELECT 
  COUNT(*) as total_agree_responses,
  COUNT(reciprocal_date) as responses_with_reciprocal_date,
  COUNT(reciprocal_start_time) as responses_with_reciprocal_start_time,
  COUNT(reciprocal_end_time) as responses_with_reciprocal_end_time,
  COUNT(reciprocal_child_id) as responses_with_reciprocal_child_id
FROM request_responses 
WHERE response_type = 'agree' AND status = 'accepted';