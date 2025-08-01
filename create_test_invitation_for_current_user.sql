-- Create a test invitation for the current user
-- This will help test the real-time invitation count update functionality

-- First, let's see what users and groups we have available
SELECT 'Available Users:' as info;
SELECT id, full_name, email FROM public.profiles LIMIT 5;

SELECT 'Available Groups:' as info;
SELECT id, name, created_by FROM public.groups LIMIT 5;

-- Now let's create a test invitation for the first user we find
-- We'll use the first group available
WITH current_user AS (
  SELECT id, email FROM public.profiles LIMIT 1
),
first_group AS (
  SELECT id FROM public.groups LIMIT 1
)
INSERT INTO public.group_invites (
  group_id,
  email,
  invited_by,
  status,
  created_at
)
SELECT 
  fg.id,
  cu.email,
  cu.id,
  'pending',
  NOW()
FROM current_user cu, first_group fg
WHERE cu.email IS NOT NULL
ON CONFLICT (group_id, email) DO NOTHING;

-- Verify the invitation was created
SELECT 'Test invitation created:' as info;
SELECT 
  gi.id,
  gi.group_id,
  gi.email,
  gi.status,
  g.name as group_name
FROM public.group_invites gi
JOIN public.groups g ON gi.group_id = g.id
WHERE gi.status = 'pending'
ORDER BY gi.created_at DESC
LIMIT 3;

-- Show the count for the current user's email
SELECT 'Pending invitations count for current user:' as info;
SELECT 
  p.email,
  COUNT(gi.id) as pending_count
FROM public.profiles p
LEFT JOIN public.group_invites gi ON LOWER(gi.email) = LOWER(p.email) AND gi.status = 'pending'
GROUP BY p.email
ORDER BY p.created_at DESC
LIMIT 3; 