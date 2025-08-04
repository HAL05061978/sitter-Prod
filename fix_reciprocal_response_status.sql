-- Fix reciprocal response status issue
-- This script will check and fix any responses with incorrect status

-- First, let's see what responses exist and their current status
SELECT '=== CURRENT RESPONSES ===' as info;
SELECT 
  cr.id,
  cr.request_id,
  cr.responder_id,
  cr.response_type,
  cr.status,
  cr.created_at,
  req.requester_id as original_requester_id,
  req.status as request_status
FROM public.care_responses cr
INNER JOIN public.care_requests req ON cr.request_id = req.id
ORDER BY cr.created_at DESC;

-- Check if there are any responses with 'pending' status that should be 'accepted' or 'declined'
SELECT '=== RESPONSES WITH INCORRECT STATUS ===' as info;
SELECT 
  cr.id,
  cr.request_id,
  cr.responder_id,
  cr.response_type,
  cr.status,
  cr.created_at
FROM public.care_responses cr
WHERE cr.status = 'pending' 
  AND cr.response_type IN ('accept', 'decline');

-- Fix any responses with incorrect status
UPDATE public.care_responses 
SET status = CASE 
  WHEN response_type = 'accept' THEN 'accepted'
  WHEN response_type = 'decline' THEN 'declined'
  ELSE status
END
WHERE status = 'pending' 
  AND response_type IN ('accept', 'decline');

-- Show the updated responses
SELECT '=== UPDATED RESPONSES ===' as info;
SELECT 
  cr.id,
  cr.request_id,
  cr.responder_id,
  cr.response_type,
  cr.status,
  cr.created_at,
  req.requester_id as original_requester_id,
  req.status as request_status
FROM public.care_responses cr
INNER JOIN public.care_requests req ON cr.request_id = req.id
ORDER BY cr.created_at DESC; 