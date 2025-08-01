-- ============================================================================
-- FIX ORPHANED PROFILE ISSUE
-- ============================================================================
-- This script fixes the issue where deleting a user from Supabase Auth
-- doesn't automatically delete the corresponding profile record

-- ============================================================================
-- STEP 1: FIND ORPHANED PROFILES
-- ============================================================================

-- Show profiles that exist but don't have corresponding auth users
SELECT 'Orphaned Profiles (profiles without auth users):' as info;
SELECT 
    p.id,
    p.full_name,
    p.email,
    p.created_at
FROM public.profiles p
LEFT JOIN auth.users au ON p.id = au.id
WHERE au.id IS NULL;

-- ============================================================================
-- STEP 2: CLEAN UP ORPHANED PROFILES
-- ============================================================================

-- Delete orphaned profiles (profiles without corresponding auth users)
DELETE FROM public.profiles 
WHERE id NOT IN (
    SELECT id FROM auth.users
);

-- ============================================================================
-- STEP 3: CREATE TRIGGER FOR AUTOMATIC CLEANUP
-- ============================================================================

-- Function to handle user deletion and clean up profiles
CREATE OR REPLACE FUNCTION public.handle_user_deleted()
RETURNS TRIGGER AS $$
BEGIN
    -- Delete the corresponding profile when a user is deleted from auth
    DELETE FROM public.profiles WHERE id = OLD.id;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS on_auth_user_deleted ON auth.users;

-- Create the trigger to fire when a user is deleted
CREATE TRIGGER on_auth_user_deleted
    AFTER DELETE ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_user_deleted();

-- ============================================================================
-- STEP 4: VERIFY CLEANUP
-- ============================================================================

-- Check if orphaned profiles still exist
SELECT 'Verification - Orphaned Profiles Remaining:' as info;
SELECT 
    p.id,
    p.full_name,
    p.email
FROM public.profiles p
LEFT JOIN auth.users au ON p.id = au.id
WHERE au.id IS NULL;

-- ============================================================================
-- STEP 5: SHOW CURRENT STATE
-- ============================================================================

-- Show current counts
SELECT 'Current State:' as info;
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
WHERE au.id IS NULL;

-- ============================================================================
-- STEP 6: TEST THE FIX
-- ============================================================================

-- Instructions for testing
SELECT 'Testing Instructions:' as info;
SELECT '1. Create a new user account' as step
UNION ALL
SELECT '2. Verify profile is created automatically' as step
UNION ALL
SELECT '3. Delete the user from Supabase Auth section' as step
UNION ALL
SELECT '4. Verify profile is automatically deleted' as step
UNION ALL
SELECT '5. Try creating the same user again - should work now' as step;

-- ============================================================================
-- COMPLETION
-- ============================================================================

SELECT '✅ Orphaned profile cleanup complete!' as status;
SELECT 'Automatic cleanup trigger installed for future user deletions.' as note;
SELECT 'You can now safely delete users from Supabase Auth without orphaned profiles.' as note; 