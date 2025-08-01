-- Debug script to check invitation statuses
-- This will help us understand why the count isn't updating correctly

-- Check all invitations for the current user's email
SELECT 'All invitations for current user:' as info;
SELECT 
  gi.id,
  gi.group_id,
  gi.email,
  gi.status,
  gi.created_at,
  g.name as group_name
FROM public.group_invites gi
JOIN public.groups g ON gi.group_id = g.id
WHERE LOWER(gi.email) = LOWER('rosmaryny10@yahoo.com')
ORDER BY gi.created_at DESC;

-- Check pending invitations specifically
SELECT 'Pending invitations only:' as info;
SELECT 
  gi.id,
  gi.group_id,
  gi.email,
  gi.status,
  gi.created_at,
  g.name as group_name
FROM public.group_invites gi
JOIN public.groups g ON gi.group_id = g.id
WHERE LOWER(gi.email) = LOWER('rosmaryny10@yahoo.com')
  AND gi.status = 'pending'
ORDER BY gi.created_at DESC;

-- Check accepted invitations
SELECT 'Accepted invitations:' as info;
SELECT 
  gi.id,
  gi.group_id,
  gi.email,
  gi.status,
  gi.created_at,
  g.name as group_name
FROM public.group_invites gi
JOIN public.groups g ON gi.group_id = g.id
WHERE LOWER(gi.email) = LOWER('rosmaryny10@yahoo.com')
  AND gi.status = 'accepted'
ORDER BY gi.created_at DESC;

-- Check if there are duplicate invitations for the same group
SELECT 'Duplicate invitations check:' as info;
SELECT 
  group_id,
  email,
  COUNT(*) as invitation_count,
  STRING_AGG(status, ', ') as statuses,
  STRING_AGG(id::text, ', ') as invitation_ids
FROM public.group_invites
WHERE LOWER(email) = LOWER('rosmaryny10@yahoo.com')
GROUP BY group_id, email
HAVING COUNT(*) > 1
ORDER BY group_id;

-- Check group_members status for this user
SELECT 'Group members status for current user:' as info;
SELECT 
  gm.group_id,
  gm.profile_id,
  gm.status,
  g.name as group_name
FROM public.group_members gm
JOIN public.groups g ON gm.group_id = g.id
JOIN public.profiles p ON gm.profile_id = p.id
WHERE LOWER(p.email) = LOWER('rosmaryny10@yahoo.com'); 