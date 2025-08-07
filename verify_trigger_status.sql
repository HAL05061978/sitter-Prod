-- Verify Trigger Status
-- This script checks if the trigger was created and is working

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
    action_statement
FROM information_schema.triggers 
WHERE trigger_name = 'handle_open_block_acceptance_trigger';

-- 3. Check trigger enable status
SELECT '=== TRIGGER ENABLE STATUS ===' as info;

SELECT 
    tgname as trigger_name,
    tgenabled as enabled,
    tgrelid::regclass as table_name
FROM pg_trigger 
WHERE tgname = 'handle_open_block_acceptance_trigger';

-- 4. Check if the trigger is properly bound to the function
SELECT '=== TRIGGER-FUNCTION BINDING ===' as info;

SELECT 
    t.tgname as trigger_name,
    p.proname as function_name,
    t.tgtype as trigger_type,
    t.tgenabled as enabled
FROM pg_trigger t
JOIN pg_proc p ON t.tgfoid = p.oid
WHERE t.tgname = 'handle_open_block_acceptance_trigger';

-- 5. Test if we can manually call the trigger function
SELECT '=== MANUAL FUNCTION TEST ===' as info;

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

-- 6. Check current invitation statuses
SELECT '=== CURRENT INVITATION STATUSES ===' as info;

SELECT 
    id,
    status,
    accepted_parent_id,
    updated_at
FROM open_block_invitations 
WHERE status = 'active'
ORDER BY created_at DESC
LIMIT 5;

-- 7. Check recent responses
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
