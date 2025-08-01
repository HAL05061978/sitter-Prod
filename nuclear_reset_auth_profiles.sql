-- ============================================================================
-- NUCLEAR RESET - COMPLETE AUTH/PROFILE CLEANUP
-- ============================================================================
-- This script completely resets the auth/profile relationship
-- WARNING: This will delete ALL profiles and reset everything

-- ============================================================================
-- STEP 1: SHOW WHAT WE'RE ABOUT TO DELETE
-- ============================================================================

SELECT 'Current State (before nuclear reset):' as info;
SELECT 
    'Auth Users' as table_name,
    COUNT(*) as count
FROM auth.users
UNION ALL
SELECT 
    'Profiles' as table_name,
    COUNT(*) as count
FROM public.profiles;

-- ============================================================================
-- STEP 2: NUCLEAR CLEANUP - DELETE ALL PROFILES
-- ============================================================================

-- Delete ALL profiles (we'll recreate them properly)
DELETE FROM public.profiles;

-- Reset the profiles sequence
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.sequences WHERE sequence_name = 'profiles_id_seq') THEN
        ALTER SEQUENCE public.profiles_id_seq RESTART WITH 1;
    END IF;
END $$;

-- ============================================================================
-- STEP 3: REMOVE ALL TRIGGERS AND FUNCTIONS
-- ============================================================================

-- Drop all triggers
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_deleted ON auth.users;

-- Drop all functions
DROP FUNCTION IF EXISTS public.handle_new_user();
DROP FUNCTION IF EXISTS public.handle_user_deleted();
DROP FUNCTION IF EXISTS public.sync_existing_auth_users();

-- ============================================================================
-- STEP 4: RECREATE EVERYTHING FROM SCRATCH
-- ============================================================================

-- Create the user creation function
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

-- Create the user deletion function
CREATE OR REPLACE FUNCTION public.handle_user_deleted()
RETURNS TRIGGER AS $$
BEGIN
    DELETE FROM public.profiles WHERE id = OLD.id;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create the sync function for existing users
CREATE OR REPLACE FUNCTION public.sync_existing_auth_users()
RETURNS VOID AS $$
DECLARE
    auth_user RECORD;
BEGIN
    FOR auth_user IN 
        SELECT 
            au.id,
            COALESCE(au.raw_user_meta_data->>'full_name', au.raw_user_meta_data->>'name', '') as full_name,
            COALESCE(au.email, '') as email,
            COALESCE(au.raw_user_meta_data->>'phone', '') as phone
        FROM auth.users au
        LEFT JOIN public.profiles p ON au.id = p.id
        WHERE p.id IS NULL
    LOOP
        INSERT INTO public.profiles (
            id,
            full_name,
            email,
            phone,
            role
        ) VALUES (
            auth_user.id,
            auth_user.full_name,
            auth_user.email,
            auth_user.phone,
            'parent'
        );
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- STEP 5: CREATE TRIGGERS
-- ============================================================================

-- Create the user creation trigger
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create the user deletion trigger
CREATE TRIGGER on_auth_user_deleted
    AFTER DELETE ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_user_deleted();

-- ============================================================================
-- STEP 6: SYNC EXISTING AUTH USERS
-- ============================================================================

-- Sync any existing auth users to profiles
SELECT sync_existing_auth_users();

-- ============================================================================
-- STEP 7: VERIFICATION
-- ============================================================================

-- Show final state
SELECT 'Final State (after nuclear reset):' as info;
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
    'Matching Records' as table_name,
    COUNT(*) as count
FROM auth.users au
INNER JOIN public.profiles p ON au.id = p.id;

-- ============================================================================
-- STEP 8: TEST INSTRUCTIONS
-- ============================================================================

SELECT 'Nuclear Reset Complete!' as info;
SELECT 'Next Steps:' as step
UNION ALL
SELECT '1. Go to Supabase Auth and delete any test users' as step
UNION ALL
SELECT '2. Try creating a new user account' as step
UNION ALL
SELECT '3. The profile should be created automatically' as step
UNION ALL
SELECT '4. No more 409 errors should occur' as step;

-- ============================================================================
-- COMPLETION
-- ============================================================================

SELECT '✅ Nuclear reset complete! All profiles deleted and recreated properly.' as status;
SELECT 'Triggers and functions reinstalled from scratch.' as note;
SELECT 'Auth-profile sync should now work perfectly.' as note; 