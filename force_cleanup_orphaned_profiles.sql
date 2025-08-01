-- ============================================================================
-- FORCE CLEANUP ORPHANED PROFILES
-- ============================================================================
-- This script aggressively cleans up orphaned profiles and resets sequences
-- to fix the 409 Conflict error when creating new users

-- ============================================================================
-- STEP 1: SHOW CURRENT ORPHANED PROFILES
-- ============================================================================

SELECT 'Current Orphaned Profiles:' as info;
SELECT 
    p.id,
    p.full_name,
    p.email,
    p.created_at,
    'ORPHANED' as status
FROM public.profiles p
LEFT JOIN auth.users au ON p.id = au.id
WHERE au.id IS NULL;

-- ============================================================================
-- STEP 2: AGGRESSIVE CLEANUP - DELETE ALL ORPHANED PROFILES
-- ============================================================================

-- Delete ALL profiles that don't have corresponding auth users
DELETE FROM public.profiles 
WHERE id NOT IN (
    SELECT id FROM auth.users
);

-- ============================================================================
-- STEP 3: RESET PROFILE SEQUENCE
-- ============================================================================

-- Reset the profiles sequence to ensure clean IDs
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.sequences WHERE sequence_name = 'profiles_id_seq') THEN
        ALTER SEQUENCE public.profiles_id_seq RESTART WITH 1;
    END IF;
END $$;

-- ============================================================================
-- STEP 4: VERIFY CLEANUP
-- ============================================================================

-- Check if any orphaned profiles remain
SELECT 'Verification - Orphaned Profiles After Cleanup:' as info;
SELECT 
    p.id,
    p.full_name,
    p.email
FROM public.profiles p
LEFT JOIN auth.users au ON p.id = au.id
WHERE au.id IS NULL;

-- ============================================================================
-- STEP 5: SHOW FINAL STATE
-- ============================================================================

-- Show final counts
SELECT 'Final State After Cleanup:' as info;
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
-- STEP 6: ENSURE TRIGGERS ARE IN PLACE
-- ============================================================================

-- Recreate the user creation trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (
        id,
        full_name,
        email,
        phone,
        role
    ) VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''),
        COALESCE(NEW.email, ''),
        COALESCE(NEW.raw_user_meta_data->>'phone', ''),
        'parent'
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop and recreate the trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Recreate the user deletion trigger
CREATE OR REPLACE FUNCTION public.handle_user_deleted()
RETURNS TRIGGER AS $$
BEGIN
    DELETE FROM public.profiles WHERE id = OLD.id;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop and recreate the deletion trigger
DROP TRIGGER IF EXISTS on_auth_user_deleted ON auth.users;
CREATE TRIGGER on_auth_user_deleted
    AFTER DELETE ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_user_deleted();

-- ============================================================================
-- STEP 7: TEST INSTRUCTIONS
-- ============================================================================

SELECT 'Next Steps:' as info;
SELECT '1. Run this script to clean up orphaned profiles' as step
UNION ALL
SELECT '2. Go to Supabase Auth section and delete any test users' as step
UNION ALL
SELECT '3. Try creating a new user account' as step
UNION ALL
SELECT '4. The profile should be created automatically without errors' as step;

-- ============================================================================
-- COMPLETION
-- ============================================================================

SELECT '✅ Force cleanup complete! All orphaned profiles removed.' as status;
SELECT 'Triggers reinstalled for automatic profile management.' as note;
SELECT 'You can now safely create new users without 409 errors.' as note; 