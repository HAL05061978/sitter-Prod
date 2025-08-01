-- ============================================================================
-- FIX USER METADATA
-- ============================================================================
-- This script checks and fixes user metadata in Supabase Auth

-- ============================================================================
-- STEP 1: CHECK CURRENT USER METADATA
-- ============================================================================

SELECT 'Current Auth User Metadata:' as info;
SELECT 
    id,
    email,
    raw_user_meta_data,
    created_at
FROM auth.users
ORDER BY created_at DESC;

-- ============================================================================
-- STEP 2: CHECK CURRENT PROFILES
-- ============================================================================

SELECT 'Current Profiles:' as info;
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
-- STEP 3: SHOW METADATA MAPPING
-- ============================================================================

SELECT 'Metadata Mapping Explanation:' as info;
SELECT 
    'Auth Field' as field,
    'Profile Field' as profile_field,
    'Source' as source
FROM (VALUES 
    ('raw_user_meta_data->>''full_name''', 'full_name', 'User metadata'),
    ('raw_user_meta_data->>''name''', 'full_name', 'Fallback name'),
    ('email', 'email', 'Auth email'),
    ('raw_user_meta_data->>''phone''', 'phone', 'User metadata')
) as mapping(field, profile_field, source);

-- ============================================================================
-- STEP 4: UPDATE TRIGGER TO HANDLE MISSING METADATA
-- ============================================================================

-- Update the trigger function to handle missing metadata better
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
        COALESCE(
            NEW.raw_user_meta_data->>'full_name', 
            NEW.raw_user_meta_data->>'name', 
            'New User'
        ),
        COALESCE(NEW.email, ''),
        COALESCE(NEW.raw_user_meta_data->>'phone', ''),
        'parent'
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- STEP 5: CREATE FUNCTION TO UPDATE EXISTING USER METADATA
-- ============================================================================

-- Function to update existing user metadata (run this manually if needed)
CREATE OR REPLACE FUNCTION update_user_metadata(
    p_user_id UUID,
    p_full_name TEXT,
    p_phone TEXT
)
RETURNS VOID AS $$
BEGIN
    -- Update the auth user metadata
    UPDATE auth.users 
    SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || 
        jsonb_build_object('full_name', p_full_name, 'phone', p_phone)
    WHERE id = p_user_id;
    
    -- Update the profile
    UPDATE public.profiles 
    SET full_name = p_full_name, phone = p_phone
    WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- STEP 6: SHOW HOW TO USE THE UPDATE FUNCTION
-- ============================================================================

SELECT 'To update existing user metadata, run:' as info;
SELECT 'SELECT update_user_metadata(''USER_ID_HERE'', ''Full Name'', ''Phone Number'');' as example;

-- ============================================================================
-- STEP 7: VERIFICATION
-- ============================================================================

-- Show the updated trigger function
SELECT 'Updated Trigger Function:' as info;
SELECT 
    routine_name,
    routine_type,
    'UPDATED' as status
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name = 'handle_new_user';

-- ============================================================================
-- COMPLETION
-- ============================================================================

SELECT '✅ User metadata handling improved!' as status;
SELECT 'New users will have proper metadata stored in auth.users' as note;
SELECT 'Existing users can be updated using update_user_metadata() function' as note; 