-- ============================================================================
-- DEBUG EMAIL MATCHING
-- ============================================================================
-- This script helps debug the email matching issue

-- ============================================================================
-- STEP 1: CHECK USER PROFILE EMAIL
-- ============================================================================

SELECT 'User profile email:' as info;
SELECT id, full_name, email, LOWER(email) as email_lower
FROM public.profiles 
WHERE id = '9911b41f-bac0-4c4a-a7fb-72ea408e74f1';

-- ============================================================================
-- STEP 2: CHECK GROUP INVITES
-- ============================================================================

SELECT 'All pending invitations:' as info;
SELECT id, email, LOWER(email) as email_lower, status
FROM public.group_invites 
WHERE status = 'pending'
ORDER BY created_at DESC;

-- ============================================================================
-- STEP 3: TEST EXACT MATCHING
-- ============================================================================

SELECT 'Testing exact match:' as info;
SELECT 
    gi.id,
    gi.email as invitation_email,
    p.email as profile_email,
    CASE 
        WHEN gi.email = p.email THEN 'EXACT MATCH'
        WHEN LOWER(gi.email) = LOWER(p.email) THEN 'CASE-INSENSITIVE MATCH'
        ELSE 'NO MATCH'
    END as match_type
FROM public.group_invites gi
CROSS JOIN public.profiles p
WHERE p.id = '9911b41f-bac0-4c4a-a7fb-72ea408e74f1'
AND gi.status = 'pending';

-- ============================================================================
-- STEP 4: TEST LOWER CASE MATCHING
-- ============================================================================

SELECT 'Testing lowercase matching:' as info;
SELECT 
    gi.id,
    gi.email as invitation_email,
    p.email as profile_email,
    LOWER(gi.email) as invitation_lower,
    LOWER(p.email) as profile_lower
FROM public.group_invites gi
CROSS JOIN public.profiles p
WHERE p.id = '9911b41f-bac0-4c4a-a7fb-72ea408e74f1'
AND gi.status = 'pending'
AND LOWER(gi.email) = LOWER(p.email);

-- ============================================================================
-- COMPLETION
-- ============================================================================

SELECT '✅ Debug complete!' as status; 