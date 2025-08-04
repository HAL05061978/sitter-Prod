-- Check header count for current user
-- This will show what the Schedule button count should be

-- Get current user's groups
WITH user_groups AS (
  SELECT group_id 
  FROM public.group_members 
  WHERE profile_id = auth.uid() 
    AND status = 'active'
),
user_responses AS (
  SELECT request_id 
  FROM public.care_responses 
  WHERE responder_id = auth.uid()
)
SELECT 
  '=== HEADER COUNT CALCULATION ===' as info,
  COUNT(*) as pending_requests_count
FROM public.care_requests cr
INNER JOIN user_groups ug ON cr.group_id = ug.group_id
LEFT JOIN user_responses ur ON cr.id = ur.request_id
WHERE cr.status != 'cancelled'
  AND cr.requester_id != auth.uid()  -- Exclude own requests
  AND ur.request_id IS NULL;  -- No response from current user

-- Show the specific requests that are being counted
SELECT '=== PENDING REQUESTS DETAILS ===' as info;
WITH user_groups AS (
  SELECT group_id 
  FROM public.group_members 
  WHERE profile_id = auth.uid() 
    AND status = 'active'
),
user_responses AS (
  SELECT request_id 
  FROM public.care_responses 
  WHERE responder_id = auth.uid()
)
SELECT 
  cr.id,
  cr.requester_id,
  cr.status,
  cr.request_type,
  cr.created_at,
  CASE 
    WHEN cr.requester_id = auth.uid() THEN 'OWN REQUEST'
    ELSE 'OTHERS REQUEST'
  END as request_owner,
  CASE 
    WHEN ur.request_id IS NULL THEN 'NO RESPONSE'
    ELSE 'HAS RESPONSE'
  END as response_status
FROM public.care_requests cr
INNER JOIN user_groups ug ON cr.group_id = ug.group_id
LEFT JOIN user_responses ur ON cr.id = ur.request_id
WHERE cr.status != 'cancelled'
  AND cr.requester_id != auth.uid()  -- Exclude own requests
  AND ur.request_id IS NULL  -- No response from current user
ORDER BY cr.created_at DESC; 