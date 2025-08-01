-- Simple debug: Check what invitations exist for this user
SELECT '=== ALL INVITATIONS FOR rosmaryny10@yahoo.com ===' as info;

SELECT 
  id,
  group_id,
  email,
  status,
  created_at
FROM public.group_invites 
WHERE LOWER(email) = LOWER('rosmaryny10@yahoo.com')
ORDER BY created_at DESC;

SELECT '=== PENDING INVITATIONS ONLY ===' as info;

SELECT 
  id,
  group_id,
  email,
  status,
  created_at
FROM public.group_invites 
WHERE LOWER(email) = LOWER('rosmaryny10@yahoo.com')
  AND status = 'pending'
ORDER BY created_at DESC; 