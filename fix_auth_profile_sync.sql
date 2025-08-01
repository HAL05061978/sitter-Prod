-- ============================================================================
-- FIX AUTH-PROFILE SYNC
-- ============================================================================
-- This script adds the missing trigger function to sync Supabase Auth user data
-- to your profiles table when users sign up

-- ============================================================================
-- STEP 1: CREATE THE TRIGGER FUNCTION
-- ============================================================================

-- Function to handle new user creation and sync auth data to profiles
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

-- ============================================================================
-- STEP 2: CREATE THE TRIGGER
-- ============================================================================

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create the trigger to fire when a new user is created
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================================
-- STEP 3: CREATE FUNCTION TO UPDATE EXISTING USERS
-- ============================================================================

-- Function to sync existing auth users to profiles (run this once)
CREATE OR REPLACE FUNCTION sync_existing_auth_users()
RETURNS VOID AS $$
DECLARE
    auth_user RECORD;
BEGIN
    -- Loop through all auth users that don't have a profile yet
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
        -- Insert profile for this auth user
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
-- STEP 4: SYNC EXISTING USERS
-- ============================================================================

-- Run this to sync any existing auth users who don't have profiles yet
SELECT sync_existing_auth_users();

-- ============================================================================
-- STEP 5: VERIFICATION
-- ============================================================================

-- Check if all auth users now have profiles
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
    'Users without profiles' as table_name,
    COUNT(*) as count
FROM auth.users au
LEFT JOIN public.profiles p ON au.id = p.id
WHERE p.id IS NULL;

-- ============================================================================
-- STEP 6: SHOW FIELD MAPPING
-- ============================================================================

SELECT 'Field Mapping:' as info;
SELECT 
    'Auth Field' as auth_field,
    'Profile Field' as profile_field,
    'Notes' as notes
FROM (VALUES 
    ('raw_user_meta_data->>''full_name''', 'full_name', 'Display name from auth'),
    ('raw_user_meta_data->>''name''', 'full_name', 'Fallback name field'),
    ('email', 'email', 'Email address'),
    ('raw_user_meta_data->>''phone''', 'phone', 'Phone number'),
    ('id', 'id', 'User ID (primary key)')
) as mapping(auth_field, profile_field, notes);

-- ============================================================================
-- COMPLETION
-- ============================================================================

SELECT '✅ Auth-Profile sync setup complete!' as status;
SELECT 'New users will automatically get profiles created when they sign up.' as note;
SELECT 'Existing users have been synced to profiles table.' as note; 