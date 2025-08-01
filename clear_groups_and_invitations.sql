-- Clear all group and invitation related records
-- This keeps profiles and children intact for testing

-- Clear group_invites table
DELETE FROM public.group_invites;

-- Clear messages related to invitations and groups
DELETE FROM public.messages 
WHERE role IN ('invite', 'invite-accepted', 'invite-rejected') 
   OR subject LIKE '%Group Invitation%'
   OR subject LIKE '%Invitation Accepted%'
   OR subject LIKE '%Invitation Rejected%';

-- Clear all group_members
DELETE FROM public.group_members;

-- Clear child_group_members
DELETE FROM public.child_group_members;

-- Clear all groups
DELETE FROM public.groups;

-- Reset sequences
ALTER SEQUENCE IF EXISTS public.group_invites_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS public.groups_id_seq RESTART WITH 1;

-- Verify the cleanup
SELECT '=== VERIFICATION ===' as info;

SELECT 'Group invites count:' as info, COUNT(*) as count FROM public.group_invites;
SELECT 'Groups count:' as info, COUNT(*) as count FROM public.groups;
SELECT 'Group members count:' as info, COUNT(*) as count FROM public.group_members;
SELECT 'Child group members count:' as info, COUNT(*) as count FROM public.child_group_members;
SELECT 'Invitation messages count:' as info, COUNT(*) as count FROM public.messages WHERE role LIKE 'invite%';

-- Show remaining profiles and children
SELECT '=== REMAINING PROFILES ===' as info;
SELECT 
  id,
  full_name,
  email,
  created_at
FROM public.profiles
ORDER BY created_at DESC;

SELECT '=== REMAINING CHILDREN ===' as info;
SELECT 
  c.id,
  c.full_name,
  c.birthdate,
  c.parent_id,
  p.full_name as parent_name,
  p.email as parent_email
FROM public.children c
JOIN public.profiles p ON c.parent_id = p.id
ORDER BY c.created_at DESC;

SELECT '✅ Groups and invitations cleared! You can now test the complete workflow from scratch.' as status; 