-- Diagnose Trigger Issue
-- This script will help identify why the trigger is not firing

-- 1. Check if the trigger function exists
SELECT '=== CHECKING TRIGGER FUNCTION ===' as info;

SELECT 
    routine_name,
    routine_type,
    routine_definition
FROM information_schema.routines 
WHERE routine_name = 'handle_open_block_acceptance';

-- 2. Check if the trigger exists
SELECT '=== CHECKING TRIGGER ===' as info;

SELECT 
    trigger_name,
    event_manipulation,
    event_object_table,
    action_timing,
    action_statement
FROM information_schema.triggers 
WHERE trigger_name = 'handle_open_block_acceptance_trigger';

-- 3. Check recent open_block_responses to see if any were created
SELECT '=== RECENT RESPONSES ===' as info;

SELECT 
    id,
    invitation_id,
    parent_id,
    response,
    child_id,
    created_at
FROM open_block_responses 
ORDER BY created_at DESC 
LIMIT 5;

-- 4. Check the specific invitation that was tested
SELECT '=== TESTED INVITATION ===' as info;

SELECT 
    id,
    open_block_id,
    invited_parent_id,
    accepted_parent_id,
    status,
    created_at,
    updated_at
FROM open_block_invitations 
WHERE id = '64cdb042-c92e-4d54-a3f9-582992d1ef89';

-- 5. Check if there are any database errors in the logs
-- (This would require checking Supabase logs in the dashboard)

-- 6. Test the trigger function manually with the actual data
SELECT '=== MANUAL TRIGGER TEST ===' as info;

-- Get the response that was created
SELECT 
    'RESPONSE DATA' as test_info,
    id,
    invitation_id,
    parent_id,
    response,
    child_id
FROM open_block_responses 
WHERE id = '18351468-33bb-4515-8ef5-8ae57387321c';

-- 7. Check if RLS policies might be blocking the trigger
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
WHERE tablename IN ('open_block_invitations', 'open_block_responses', 'scheduled_care', 'scheduled_care_children');

-- 8. Check if the trigger is enabled
SELECT '=== TRIGGER STATUS ===' as info;

SELECT 
    tgname as trigger_name,
    tgenabled as enabled,
    tgrelid::regclass as table_name
FROM pg_trigger 
WHERE tgname = 'handle_open_block_acceptance_trigger';

-- 9. Check if there are any syntax errors in the function
SELECT '=== FUNCTION VALIDITY ===' as info;

SELECT 
    proname as function_name,
    prosrc as source_code
FROM pg_proc 
WHERE proname = 'handle_open_block_acceptance';

-- 10. Test a simple trigger execution
SELECT '=== SIMPLE TRIGGER TEST ===' as info;

-- Try to manually call the trigger function with test data
-- (This will help identify if the function itself has errors)

DO $$
DECLARE
    test_response open_block_responses%ROWTYPE;
BEGIN
    -- Create a test response record
    test_response.id := gen_random_uuid();
    test_response.invitation_id := '64cdb042-c92e-4d54-a3f9-582992d1ef89';
    test_response.parent_id := '8c7b93f6-582d-4208-9cdd-65a940a1d18d';
    test_response.response := 'accept';
    test_response.child_id := (SELECT id FROM children WHERE parent_id = '8c7b93f6-582d-4208-9cdd-65a940a1d18d' LIMIT 1);
    test_response.created_at := NOW();
    
    RAISE NOTICE 'Testing trigger function manually...';
    RAISE NOTICE 'Test response: invitation_id=%, parent_id=%, response=%, child_id=%', 
        test_response.invitation_id, test_response.parent_id, test_response.response, test_response.child_id;
    
    -- Try to call the trigger function manually
    PERFORM handle_open_block_acceptance();
    
    RAISE NOTICE 'Manual trigger test completed';
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Error in manual trigger test: %', SQLERRM;
        RAISE NOTICE 'SQLSTATE: %', SQLSTATE;
END $$;

-- Success message
SELECT 'Trigger diagnosis completed. Check the results above.' as status;
