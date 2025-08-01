-- ============================================================================
-- FRESH START CLEANUP
-- ============================================================================
-- This script clears all records to start fresh for testing
-- WARNING: This will delete ALL data in your application

-- ============================================================================
-- STEP 1: CLEAR ALL COMMUNICATION DATA
-- ============================================================================

-- Clear chat messages
DELETE FROM public.chat_messages;
SELECT 'Chat messages cleared' as status;

-- ============================================================================
-- STEP 2: CLEAR ALL EVENT SYSTEM DATA
-- ============================================================================

-- Clear event responses
DELETE FROM public.event_responses;
SELECT 'Event responses cleared' as status;

-- Clear event notifications
DELETE FROM public.event_notifications;
SELECT 'Event notifications cleared' as status;

-- ============================================================================
-- STEP 3: CLEAR ALL SCHEDULING DATA
-- ============================================================================

-- Clear scheduled care
DELETE FROM public.scheduled_care;
SELECT 'Scheduled care cleared' as status;

-- Clear care requests
DELETE FROM public.care_requests;
SELECT 'Care requests cleared' as status;

-- Clear care responses
DELETE FROM public.care_responses;
SELECT 'Care responses cleared' as status;

-- ============================================================================
-- STEP 4: CLEAR ALL GROUP DATA
-- ============================================================================

-- Clear child group members (must be first due to foreign key)
DELETE FROM public.child_group_members;
SELECT 'Child group members cleared' as status;

-- Clear group members
DELETE FROM public.group_members;
SELECT 'Group members cleared' as status;

-- Clear groups
DELETE FROM public.groups;
SELECT 'Groups cleared' as status;

-- ============================================================================
-- STEP 5: CLEAR ALL CHILDREN DATA
-- ============================================================================

-- Clear children
DELETE FROM public.children;
SELECT 'Children cleared' as status;

-- ============================================================================
-- STEP 6: CLEAR ALL PROFILES AND AUTH USERS
-- ============================================================================

-- Clear profiles
DELETE FROM public.profiles;
SELECT 'Profiles cleared' as status;

-- Clear auth users (this will also clear profiles via trigger)
DELETE FROM auth.users;
SELECT 'Auth users cleared' as status;

-- ============================================================================
-- STEP 7: RESET SEQUENCES
-- ============================================================================

-- Reset any sequences that might exist
DO $$
DECLARE
    seq_name text;
BEGIN
    FOR seq_name IN 
        SELECT sequence_name 
        FROM information_schema.sequences 
        WHERE sequence_schema = 'public'
    LOOP
        EXECUTE 'ALTER SEQUENCE ' || seq_name || ' RESTART WITH 1';
    END LOOP;
END $$;
SELECT 'Sequences reset' as status;

-- ============================================================================
-- STEP 8: VERIFICATION
-- ============================================================================

-- Check that all tables are empty
SELECT 'Verification - All tables should be empty:' as info;

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
    'Children' as table_name,
    COUNT(*) as count
FROM public.children
UNION ALL
SELECT 
    'Groups' as table_name,
    COUNT(*) as count
FROM public.groups
UNION ALL
SELECT 
    'Group Members' as table_name,
    COUNT(*) as count
FROM public.group_members
UNION ALL
SELECT 
    'Child Group Members' as table_name,
    COUNT(*) as count
FROM public.child_group_members
UNION ALL
SELECT 
    'Care Requests' as table_name,
    COUNT(*) as count
FROM public.care_requests
UNION ALL
SELECT 
    'Scheduled Care' as table_name,
    COUNT(*) as count
FROM public.scheduled_care
UNION ALL
SELECT 
    'Care Responses' as table_name,
    COUNT(*) as count
FROM public.care_responses
UNION ALL
SELECT 
    'Event Responses' as table_name,
    COUNT(*) as count
FROM public.event_responses
UNION ALL
SELECT 
    'Event Notifications' as table_name,
    COUNT(*) as count
FROM public.event_notifications
UNION ALL
SELECT 
    'Chat Messages' as table_name,
    COUNT(*) as count
FROM public.chat_messages;

-- ============================================================================
-- STEP 9: REINSTALL TRIGGERS
-- ============================================================================

-- Reinstall the user creation trigger
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

-- Create the trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create the user deletion trigger
CREATE OR REPLACE FUNCTION public.handle_user_deleted()
RETURNS TRIGGER AS $$
BEGIN
    DELETE FROM public.profiles WHERE id = OLD.id;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_deleted ON auth.users;
CREATE TRIGGER on_auth_user_deleted
    AFTER DELETE ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_user_deleted();

SELECT 'Triggers reinstalled' as status;

-- ============================================================================
-- COMPLETION
-- ============================================================================

SELECT '✅ Fresh start complete!' as status;
SELECT 'All data cleared and triggers reinstalled' as note;
SELECT 'You can now test your app from scratch' as note; 