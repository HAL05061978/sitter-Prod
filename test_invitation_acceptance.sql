-- ============================================================================
-- TEST INVITATION ACCEPTANCE
-- ============================================================================
-- This script helps debug what happens when invitations are accepted

-- ============================================================================
-- STEP 1: CHECK CURRENT INVITATIONS
-- ============================================================================

SELECT 'Current invitations for hugo.lopez10@gmail.com:' as info;
SELECT 
    id,
    email,
    status,
    created_at
FROM public.group_invites 
WHERE email = 'hugo.lopez10@gmail.com'
ORDER BY created_at DESC;

-- ============================================================================
-- STEP 2: CHECK GROUP MEMBERS
-- ============================================================================

SELECT 'Current group members for user:' as info;
SELECT 
    gm.group_id,
    gm.profile_id,
    gm.status,
    gm.joined_at,
    g.name as group_name
FROM public.group_members gm
JOIN public.groups g ON gm.group_id = g.id
WHERE gm.profile_id = '9911b41f-bac0-4c4a-a7fb-72ea408e74f1'
ORDER BY gm.joined_at DESC;

-- ============================================================================
-- STEP 3: SIMULATE ACCEPTING AN INVITATION
-- ============================================================================

-- Let's see what happens when we manually accept an invitation
SELECT 'Simulating invitation acceptance...' as info;

-- Update the invitation status to accepted
UPDATE public.group_invites 
SET status = 'accepted'
WHERE email = 'hugo.lopez10@gmail.com' 
AND status = 'pending'
AND id = (
    SELECT id 
    FROM public.group_invites 
    WHERE email = 'hugo.lopez10@gmail.com' 
    AND status = 'pending' 
    ORDER BY created_at DESC 
    LIMIT 1
);

-- ============================================================================
-- STEP 4: CHECK RESULTS
-- ============================================================================

SELECT 'After acceptance - invitations:' as info;
SELECT 
    id,
    email,
    status,
    created_at
FROM public.group_invites 
WHERE email = 'hugo.lopez10@gmail.com'
ORDER BY created_at DESC;

SELECT 'After acceptance - group members:' as info;
SELECT 
    gm.group_id,
    gm.profile_id,
    gm.status,
    gm.joined_at,
    g.name as group_name
FROM public.group_members gm
JOIN public.groups g ON gm.group_id = g.id
WHERE gm.profile_id = '9911b41f-bac0-4c4a-a7fb-72ea408e74f1'
ORDER BY gm.joined_at DESC;

-- ============================================================================
-- STEP 5: TEST PENDING COUNT QUERY
-- ============================================================================

SELECT 'Testing pending count query:' as info;
SELECT 
    p.email as user_email,
    COUNT(gi.id) as pending_count
FROM public.profiles p
LEFT JOIN public.group_invites gi ON gi.email = p.email AND gi.status = 'pending'
WHERE p.id = '9911b41f-bac0-4c4a-a7fb-72ea408e74f1'
GROUP BY p.id, p.email;

-- ============================================================================
-- COMPLETION
-- ============================================================================

SELECT '✅ Test complete!' as status; 