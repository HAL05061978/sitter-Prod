-- ============================================================================
-- DIAGNOSE PROFILE-AUTH MISMATCH
-- ============================================================================
-- This script will show us exactly what's happening with the auth/profile sync

-- ============================================================================
-- STEP 1: SHOW ALL AUTH USERS
-- ============================================================================

SELECT 'All Auth Users:' as info;
SELECT 
    id,
    email,
    raw_user_meta_data,
    created_at
FROM auth.users
ORDER BY created_at DESC;

-- ============================================================================
-- STEP 2: SHOW ALL PROFILES
-- ============================================================================

SELECT 'All Profiles:' as info;
SELECT 
    id,
    full_name,
    email,
    phone,
    role,
    created_at
FROM public.profiles
ORDER BY created_at DESC;

-- ============================================================================
-- STEP 3: SHOW MISMATCHES
-- ============================================================================

-- Auth users without profiles
SELECT 'Auth Users WITHOUT Profiles:' as info;
SELECT 
    au.id as auth_id,
    au.email as auth_email,
    au.raw_user_meta_data,
    au.created_at as auth_created
FROM auth.users au
LEFT JOIN public.profiles p ON au.id = p.id
WHERE p.id IS NULL;

-- Profiles without auth users
SELECT 'Profiles WITHOUT Auth Users:' as info;
SELECT 
    p.id as profile_id,
    p.full_name,
    p.email as profile_email,
    p.created_at as profile_created
FROM public.profiles p
LEFT JOIN auth.users au ON p.id = au.id
WHERE au.id IS NULL;

-- ============================================================================
-- STEP 4: SHOW MATCHING RECORDS
-- ============================================================================

-- Records that exist in both tables
SELECT 'Matching Records (Auth + Profile):' as info;
SELECT 
    au.id,
    au.email as auth_email,
    p.email as profile_email,
    p.full_name,
    au.created_at as auth_created,
    p.created_at as profile_created
FROM auth.users au
INNER JOIN public.profiles p ON au.id = p.id
ORDER BY au.created_at DESC;

-- ============================================================================
-- STEP 5: CHECK FOR DUPLICATE EMAILS
-- ============================================================================

-- Check for duplicate emails across auth and profiles
SELECT 'Duplicate Emails (Auth vs Profiles):' as info;
SELECT 
    email,
    COUNT(*) as count,
    'auth_users' as source
FROM auth.users
GROUP BY email
HAVING COUNT(*) > 1
UNION ALL
SELECT 
    email,
    COUNT(*) as count,
    'profiles' as source
FROM public.profiles
WHERE email IS NOT NULL
GROUP BY email
HAVING COUNT(*) > 1;

-- ============================================================================
-- STEP 6: SHOW TRIGGER STATUS
-- ============================================================================

-- Check if triggers exist
SELECT 'Trigger Status:' as info;
SELECT 
    trigger_name,
    event_manipulation,
    action_statement,
    'EXISTS' as status
FROM information_schema.triggers 
WHERE trigger_schema = 'public' 
AND event_object_table = 'users'
AND event_object_schema = 'auth'
UNION ALL
SELECT 
    'on_auth_user_created' as trigger_name,
    'INSERT' as event_manipulation,
    'handle_new_user()' as action_statement,
    CASE WHEN EXISTS (
        SELECT 1 FROM information_schema.triggers 
        WHERE trigger_name = 'on_auth_user_created'
    ) THEN 'EXISTS' ELSE 'MISSING' END as status;

-- ============================================================================
-- STEP 7: SHOW FUNCTION STATUS
-- ============================================================================

-- Check if functions exist
SELECT 'Function Status:' as info;
SELECT 
    routine_name,
    routine_type,
    'EXISTS' as status
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name IN ('handle_new_user', 'handle_user_deleted')
UNION ALL
SELECT 
    'handle_new_user' as routine_name,
    'FUNCTION' as routine_type,
    CASE WHEN EXISTS (
        SELECT 1 FROM information_schema.routines 
        WHERE routine_schema = 'public' 
        AND routine_name = 'handle_new_user'
    ) THEN 'EXISTS' ELSE 'MISSING' END as status
UNION ALL
SELECT 
    'handle_user_deleted' as routine_name,
    'FUNCTION' as routine_type,
    CASE WHEN EXISTS (
        SELECT 1 FROM information_schema.routines 
        WHERE routine_schema = 'public' 
        AND routine_name = 'handle_user_deleted'
    ) THEN 'EXISTS' ELSE 'MISSING' END as status;

-- ============================================================================
-- STEP 8: SUMMARY
-- ============================================================================

SELECT 'Summary:' as info;
SELECT 
    'Auth Users' as table_name,
    COUNT(*) as count
FROM auth.users
UNION ALL
SELECT 
    'Profiles' as table_name,
    COUNT(*) as count
FROM public.profiles
UNION ALL
SELECT 
    'Orphaned Profiles' as table_name,
    COUNT(*) as count
FROM public.profiles p
LEFT JOIN auth.users au ON p.id = au.id
WHERE au.id IS NULL
UNION ALL
SELECT 
    'Auth Users without Profiles' as table_name,
    COUNT(*) as count
FROM auth.users au
LEFT JOIN public.profiles p ON au.id = p.id
WHERE p.id IS NULL; 