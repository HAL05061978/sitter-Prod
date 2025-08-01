-- Clear invitation-related records for testing
-- This keeps groups, children, and profiles intact

-- Clear group_invites table
DELETE FROM public.group_invites;

-- Clear messages related to invitations
DELETE FROM public.messages 
WHERE role IN ('invite', 'invite-accepted', 'invite-rejected');

-- Clear any group_members with 'pending' status (invitations that were in progress)
DELETE FROM public.group_members 
WHERE status = 'pending';

-- Reset sequences if needed
ALTER SEQUENCE IF EXISTS public.group_invites_id_seq RESTART WITH 1;

-- Verify the cleanup
SELECT '=== VERIFICATION ===' as info;

SELECT 'Group invites count:' as info, COUNT(*) as count FROM public.group_invites;
SELECT 'Invitation messages count:' as info, COUNT(*) as count FROM public.messages WHERE role LIKE 'invite%';
SELECT 'Pending group members count:' as info, COUNT(*) as count FROM public.group_members WHERE status = 'pending';

-- Show remaining active group memberships
SELECT 'Active group memberships:' as info;
SELECT 
  gm.profile_id,
  gm.group_id,
  gm.status,
  p.email,
  g.name as group_name
FROM public.group_members gm
JOIN public.profiles p ON gm.profile_id = p.id
JOIN public.groups g ON gm.group_id = g.id
WHERE gm.status = 'active'
ORDER BY p.email, g.name;

SELECT '✅ Invitation records cleared! You can now send new invitations.' as status; 