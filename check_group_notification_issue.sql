-- Check if group creators are being notified properly for event groups
-- This will help diagnose why event group acceptance notifications aren't working

-- Check all groups and their creators
SELECT '=== ALL GROUPS AND CREATORS ===' as info;
SELECT 
  g.id,
  g.name,
  g.group_type,
  g.created_by,
  p.full_name as creator_name,
  p.email as creator_email
FROM public.groups g
JOIN public.profiles p ON g.created_by = p.id
ORDER BY g.created_at DESC;

-- Check group members for a specific group (replace with actual group ID)
SELECT '=== GROUP MEMBERS FOR TESTING ===' as info;
SELECT 
  gm.group_id,
  gm.profile_id,
  gm.status,
  gm.role,
  p.full_name,
  p.email,
  g.name as group_name,
  g.group_type
FROM public.group_members gm
JOIN public.profiles p ON gm.profile_id = p.id
JOIN public.groups g ON gm.group_id = g.id
WHERE gm.status = 'active'
ORDER BY g.name, p.full_name;

-- Check recent invitation acceptances
SELECT '=== RECENT INVITATION ACCEPTANCES ===' as info;
SELECT 
  gi.group_id,
  gi.email,
  gi.status,
  gi.created_at,
  g.name as group_name,
  g.group_type,
  g.created_by
FROM public.group_invites gi
JOIN public.groups g ON gi.group_id = g.id
WHERE gi.status = 'accepted'
ORDER BY gi.created_at DESC
LIMIT 10;

-- Check if there are any messages sent to group creators
SELECT '=== RECENT NOTIFICATION MESSAGES ===' as info;
SELECT 
  m.id,
  m.subject,
  m.content,
  m.recipient_id,
  m.created_at,
  p.full_name as recipient_name,
  p.email as recipient_email
FROM public.messages m
JOIN public.profiles p ON m.recipient_id = p.id
WHERE m.role LIKE '%accepted%'
ORDER BY m.created_at DESC
LIMIT 10; 