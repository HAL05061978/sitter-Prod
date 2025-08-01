-- Fix the invitation status for the group the user has already joined
-- The user is an active member of group d078a71b-3e91-45ff-ae79-a9d602249ad9
-- but the invitation status is still 'pending'

UPDATE public.group_invites 
SET status = 'accepted'
WHERE group_id = 'd078a71b-3e91-45ff-ae79-a9d602249ad9'
  AND email = 'rosmaryny10@yahoo.com'
  AND status = 'pending';

-- Verify the fix
SELECT '=== AFTER FIX ===' as info;
SELECT 
  id,
  group_id,
  email,
  status,
  created_at
FROM public.group_invites 
WHERE LOWER(email) = LOWER('rosmaryny10@yahoo.com')
ORDER BY created_at DESC; 