-- Debug script to check scheduled blocks and their times
-- Run this in Supabase SQL editor to see what blocks exist

-- Check all scheduled blocks with their details
SELECT 
  sb.id,
  sb.group_id,
  sb.parent_id,
  sb.child_id,
  sb.scheduled_date,
  sb.start_time,
  sb.end_time,
  sb.duration_minutes,
  sb.block_type,
  sb.status,
  sb.request_id,
  c.full_name as child_name,
  p.full_name as parent_name
FROM scheduled_blocks sb
LEFT JOIN children c ON sb.child_id = c.id
LEFT JOIN profiles p ON sb.parent_id = p.id
ORDER BY sb.scheduled_date, sb.start_time;

-- Check the most recent request_responses to see what reciprocal data was submitted
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
  c.full_name as reciprocal_child_name
FROM request_responses rr
LEFT JOIN profiles p ON rr.responder_id = p.id
LEFT JOIN children c ON rr.reciprocal_child_id = c.id
ORDER BY rr.created_at DESC
LIMIT 10;

-- Check the most recent babysitting requests
SELECT 
  br.id,
  br.group_id,
  br.initiator_id,
  br.child_id,
  br.requested_date,
  br.start_time,
  br.end_time,
  br.duration_minutes,
  br.status,
  p.full_name as initiator_name,
  c.full_name as child_name
FROM babysitting_requests br
LEFT JOIN profiles p ON br.initiator_id = p.id
LEFT JOIN children c ON br.child_id = c.id
ORDER BY br.created_at DESC
LIMIT 10;

-- Check if there are any blocks with the same request_id but different times
-- This should show us if reciprocal blocks are being created correctly
SELECT 
  request_id,
  COUNT(*) as block_count,
  STRING_AGG(CONCAT(block_type, ': ', start_time, '-', end_time, ' on ', scheduled_date), ' | ') as block_details
FROM scheduled_blocks 
WHERE status = 'confirmed'
GROUP BY request_id
HAVING COUNT(*) > 1
ORDER BY request_id;