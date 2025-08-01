-- Simple test to check email data
SELECT '=== USER PROFILE ===' as section;
SELECT id, email FROM public.profiles WHERE id = '9911b41f-bac0-4c4a-a7fb-72ea408e74f1';

SELECT '=== ALL PENDING INVITATIONS ===' as section;
SELECT id, email, status FROM public.group_invites WHERE status = 'pending';

SELECT '=== TESTING MATCH ===' as section;
SELECT 
    p.email as profile_email,
    gi.email as invitation_email,
    CASE 
        WHEN gi.email = p.email THEN 'EXACT'
        WHEN LOWER(gi.email) = LOWER(p.email) THEN 'CASE-INSENSITIVE'
        ELSE 'NO MATCH'
    END as match_type
FROM public.profiles p
CROSS JOIN public.group_invites gi
WHERE p.id = '9911b41f-bac0-4c4a-a7fb-72ea408e74f1'
AND gi.status = 'pending'; 