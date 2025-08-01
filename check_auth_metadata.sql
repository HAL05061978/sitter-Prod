-- ============================================================================
-- CHECK AUTH METADATA
-- ============================================================================
-- This script checks the actual auth.users data to see what's stored

-- ============================================================================
-- STEP 1: CHECK THE ACTUAL AUTH.USERS DATA
-- ============================================================================

SELECT 'Raw Auth Users Data:' as info;
SELECT 
    id,
    email,
    raw_user_meta_data,
    created_at
FROM auth.users
ORDER BY created_at DESC;

-- ============================================================================
-- STEP 2: CHECK SPECIFIC USER METADATA
-- ============================================================================

SELECT 'Specific User Metadata Analysis:' as info;
SELECT 
    id,
    email,
    raw_user_meta_data->>'full_name' as full_name_from_metadata,
    raw_user_meta_data->>'phone' as phone_from_metadata,
    raw_user_meta_data->>'email' as email_from_metadata
FROM auth.users
WHERE email LIKE '%hugo%'
ORDER BY created_at DESC;

-- ============================================================================
-- STEP 3: COMPARE WITH PROFILES
-- ============================================================================

SELECT 'Profile vs Auth Comparison:' as info;
SELECT 
    p.id,
    p.full_name as profile_full_name,
    p.email as profile_email,
    p.phone as profile_phone,
    au.raw_user_meta_data->>'full_name' as auth_full_name,
    au.raw_user_meta_data->>'phone' as auth_phone,
    au.email as auth_email
FROM public.profiles p
JOIN auth.users au ON p.id = au.id
ORDER BY p.created_at DESC;

-- ============================================================================
-- STEP 4: EXPLAIN THE DISCREPANCY
-- ============================================================================

SELECT 'Explanation:' as info;
SELECT 
    'The Supabase Auth UI Phone column is separate from user metadata' as note,
    'Phone numbers in metadata are stored in raw_user_meta_data but not displayed in the UI' as explanation,
    'This is normal behavior - the UI only shows the dedicated phone field, not metadata' as conclusion; 