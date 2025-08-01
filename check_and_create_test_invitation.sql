-- ============================================================================
-- CHECK AND CREATE TEST INVITATION
-- ============================================================================
-- This script checks current invitations and creates a test one

-- ============================================================================
-- STEP 1: CHECK CURRENT INVITATIONS
-- ============================================================================

SELECT 'Current group_invites:' as info;
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
-- STEP 2: CHECK CURRENT USER'S EMAIL
-- ============================================================================

SELECT 'Current user profiles:' as info;
SELECT id, full_name, email FROM public.profiles ORDER BY created_at DESC LIMIT 5;

-- ============================================================================
-- STEP 3: CHECK AVAILABLE GROUPS
-- ============================================================================

SELECT 'Available groups:' as info;
SELECT id, name, created_by FROM public.groups ORDER BY created_at DESC LIMIT 5;

-- ============================================================================
-- STEP 4: CREATE TEST INVITATION
-- ============================================================================

-- Get the first user and group to create a test invitation
DO $$
DECLARE
    test_user_id UUID;
    test_group_id UUID;
    test_user_email TEXT;
BEGIN
    -- Get first user
    SELECT id, email INTO test_user_id, test_user_email
    FROM public.profiles 
    ORDER BY created_at DESC 
    LIMIT 1;
    
    -- Get first group
    SELECT id INTO test_group_id
    FROM public.groups 
    ORDER BY created_at DESC 
    LIMIT 1;
    
    -- Create test invitation
    IF test_user_id IS NOT NULL AND test_group_id IS NOT NULL THEN
        INSERT INTO public.group_invites (
            group_id,
            email,
            invited_by,
            status
        ) VALUES (
            test_group_id,
            test_user_email,
            test_user_id,
            'pending'
        );
        
        RAISE NOTICE 'Created test invitation for email: %', test_user_email;
    ELSE
        RAISE NOTICE 'No users or groups found to create test invitation';
    END IF;
END $$;

-- ============================================================================
-- STEP 5: VERIFY TEST INVITATION
-- ============================================================================

SELECT 'Test invitation created:' as info;
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

SELECT '✅ Test invitation created!' as status;
SELECT 'Check your dashboard Messages button for the notification count' as note; 