-- Check if Trigger Exists and is Properly Configured
-- This script will help us identify why the trigger is not firing

-- 1. Check if the trigger function exists
SELECT '=== TRIGGER FUNCTION STATUS ===' as info;

SELECT 
    routine_name,
    routine_type,
    routine_definition IS NOT NULL as has_definition
FROM information_schema.routines 
WHERE routine_name = 'handle_open_block_acceptance';

-- 2. Check if the trigger exists and its configuration
SELECT '=== TRIGGER CONFIGURATION ===' as info;

SELECT 
    trigger_name,
    event_manipulation,
    event_object_table,
    action_timing,
    action_statement,
    action_orientation,
    action_condition
FROM information_schema.triggers 
WHERE trigger_name = 'handle_open_block_acceptance_trigger';

-- 3. Check trigger enable status using pg_trigger
SELECT '=== TRIGGER ENABLE STATUS ===' as info;

SELECT 
    tgname as trigger_name,
    tgenabled as enabled,
    tgrelid::regclass as table_name,
    tgtype as trigger_type
FROM pg_trigger 
WHERE tgname = 'handle_open_block_acceptance_trigger';

-- 4. Check if the trigger is actually attached to the table
SELECT '=== TRIGGER ATTACHMENT ===' as info;

SELECT 
    n.nspname as schema_name,
    c.relname as table_name,
    t.tgname as trigger_name,
    t.tgtype as trigger_type
FROM pg_trigger t
JOIN pg_class c ON t.tgrelid = c.oid
JOIN pg_namespace n ON c.relnamespace = n.oid
WHERE t.tgname = 'handle_open_block_acceptance_trigger';

-- 5. Check if there are any syntax errors in the function
SELECT '=== FUNCTION SYNTAX CHECK ===' as info;

DO $$
BEGIN
    -- Try to call the function to see if it has syntax errors
    PERFORM handle_open_block_acceptance();
    RAISE NOTICE 'Function exists and has no syntax errors';
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Function error: %', SQLERRM;
        RAISE NOTICE 'SQLSTATE: %', SQLSTATE;
END $$;

-- 6. Check RLS policies that might be blocking the trigger
SELECT '=== RLS POLICIES ===' as info;

SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE tablename IN ('open_block_invitations', 'open_block_responses', 'scheduled_care', 'scheduled_care_children')
    AND schemaname = 'public';

-- 7. Check if the trigger is disabled
SELECT '=== TRIGGER DISABLE STATUS ===' as info;

SELECT 
    tgname as trigger_name,
    CASE tgenabled
        WHEN 'O' THEN 'Enabled'
        WHEN 'D' THEN 'Disabled'
        WHEN 'R' THEN 'Replica'
        WHEN 'A' THEN 'Always'
        ELSE 'Unknown'
    END as enable_status
FROM pg_trigger 
WHERE tgname = 'handle_open_block_acceptance_trigger';

-- 8. Check if the function has the correct signature
SELECT '=== FUNCTION SIGNATURE ===' as info;

SELECT 
    proname as function_name,
    pronargs as argument_count,
    proargtypes::regtype[] as argument_types,
    prorettype::regtype as return_type
FROM pg_proc 
WHERE proname = 'handle_open_block_acceptance';

-- 9. Check if the trigger is properly bound to the function
SELECT '=== TRIGGER-FUNCTION BINDING ===' as info;

SELECT 
    t.tgname as trigger_name,
    p.proname as function_name,
    t.tgtype as trigger_type,
    t.tgenabled as enabled
FROM pg_trigger t
JOIN pg_proc p ON t.tgfoid = p.oid
WHERE t.tgname = 'handle_open_block_acceptance_trigger';

-- 10. Test if we can manually call the trigger function
SELECT '=== MANUAL FUNCTION TEST ===' as info;

DO $$
DECLARE
    test_new open_block_responses%ROWTYPE;
    test_old open_block_responses%ROWTYPE;
BEGIN
    -- Create test data that the trigger function expects
    test_new.id := gen_random_uuid();
    test_new.invitation_id := '193e024b-0b72-4ebd-a280-2768d95b6be9';
    test_new.parent_id := '8c7b93f6-582d-4208-9cdd-65a940a1d18d';
    test_new.response := 'accept';
    test_new.child_id := '7d88bd93-2ad1-4560-ad06-47ae9e769fa7';
    test_new.created_at := NOW();
    
    test_old := NULL; -- For INSERT triggers, OLD is NULL
    
    RAISE NOTICE 'Testing trigger function manually...';
    RAISE NOTICE 'NEW record: invitation_id=%, parent_id=%, response=%', 
        test_new.invitation_id, test_new.parent_id, test_new.response;
    
    -- Try to call the trigger function manually
    PERFORM handle_open_block_acceptance();
    
    RAISE NOTICE 'Manual trigger test completed successfully';
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Error in manual trigger test: %', SQLERRM;
        RAISE NOTICE 'SQLSTATE: %', SQLSTATE;
END $$;
