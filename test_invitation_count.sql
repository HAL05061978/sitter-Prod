-- ============================================================================
-- TEST INVITATION COUNT
-- ============================================================================
-- This script creates test invitations to verify the notification count works

-- ============================================================================
-- STEP 1: CHECK CURRENT INVITATIONS
-- ============================================================================

SELECT 'Current invitations:' as info;
SELECT 
    id,
    group_id,
    email,
    invited_by,
    status,
    created_at
FROM public.group_invites
ORDER BY created_at DESC;

-- ============================================================================
-- STEP 2: CREATE TEST INVITATIONS
-- ============================================================================

-- First, let's get some existing users and groups
SELECT 'Available users:' as info;
SELECT id, full_name, email FROM public.profiles LIMIT 5;

SELECT 'Available groups:' as info;
SELECT id, name, created_by FROM public.groups LIMIT 5;

-- ============================================================================
-- STEP 3: CREATE TEST INVITATION (if you have users and groups)
-- ============================================================================

-- Uncomment and modify these lines to create test invitations
-- Replace the UUIDs with actual user and group IDs from your database

/*
INSERT INTO public.group_invites (
    group_id,
    email,
    invited_by,
    status,
    notes
) VALUES (
    'YOUR_GROUP_ID_HERE',
    'test@example.com',
    'YOUR_INVITER_ID_HERE',
    'pending',
    'Test invitation for notification count'
);
*/

-- ============================================================================
-- STEP 4: VERIFICATION
-- ============================================================================

-- Check pending invitations for a specific email
SELECT 'Pending invitations for email:' as info;
SELECT 
    gi.id,
    gi.status,
    g.name as group_name,
    p.full_name as inviter_name,
    gi.email,
    gi.created_at
FROM public.group_invites gi
JOIN public.groups g ON gi.group_id = g.id
JOIN public.profiles p ON gi.invited_by = p.id
WHERE gi.status = 'pending'
ORDER BY gi.created_at DESC;

-- ============================================================================
-- COMPLETION
-- ============================================================================

SELECT '✅ Test script complete!' as status;
SELECT 'Check the dashboard Messages button for notification count' as note;
SELECT 'The count should update in real-time when invitations change' as note; 