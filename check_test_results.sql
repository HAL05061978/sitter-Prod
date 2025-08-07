-- Check Test Results
-- This script will check if the trigger fired and updated the invitation

-- 1. Check the specific invitation that was tested
SELECT '=== TESTED INVITATION STATUS ===' as info;

SELECT 
    id,
    open_block_id,
    invited_parent_id,
    accepted_parent_id,
    status,
    created_at,
    updated_at
FROM open_block_invitations 
WHERE id = '193e024b-0b72-4ebd-a280-2768d95b6be9';

-- 2. Check if any invitations were updated in the last 10 minutes
SELECT '=== RECENTLY UPDATED INVITATIONS ===' as info;

SELECT 
    id,
    status,
    accepted_parent_id,
    updated_at
FROM open_block_invitations 
WHERE updated_at > NOW() - INTERVAL '10 minutes'
ORDER BY updated_at DESC;

-- 3. Check if any care children were created
SELECT '=== CARE CHILDREN CREATED ===' as info;

SELECT 
    id,
    scheduled_care_id,
    child_id,
    notes,
    created_at
FROM scheduled_care_children 
WHERE notes LIKE '%Open block acceptance%'
    AND created_at > NOW() - INTERVAL '10 minutes'
ORDER BY created_at DESC;

-- 4. Check if any care blocks were created
SELECT '=== CARE BLOCKS CREATED ===' as info;

SELECT 
    id,
    parent_id,
    start_time,
    end_time,
    notes,
    created_at
FROM scheduled_care 
WHERE notes LIKE '%Open block acceptance%'
    AND created_at > NOW() - INTERVAL '10 minutes'
ORDER BY created_at DESC;

-- 5. Check if the trigger exists and is enabled
SELECT '=== TRIGGER STATUS ===' as info;

SELECT 
    trigger_name,
    event_manipulation,
    event_object_table,
    action_timing,
    action_statement
FROM information_schema.triggers 
WHERE trigger_name = 'handle_open_block_acceptance_trigger';

-- 6. Check trigger enable status
SELECT '=== TRIGGER ENABLE STATUS ===' as info;

SELECT 
    tgname as trigger_name,
    tgenabled as enabled,
    tgrelid::regclass as table_name
FROM pg_trigger 
WHERE tgname = 'handle_open_block_acceptance_trigger';

-- 7. Check if the function exists
SELECT '=== FUNCTION STATUS ===' as info;

SELECT 
    routine_name,
    routine_type
FROM information_schema.routines 
WHERE routine_name = 'handle_open_block_acceptance';

-- 8. Check RLS policies that might be blocking the trigger
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

-- 9. Check database logs for any errors (if available)
-- This would require checking Supabase logs in the dashboard
SELECT '=== CHECK SUPABASE LOGS FOR ERRORS ===' as info;
SELECT 'Go to Supabase Dashboard > Logs to check for trigger execution errors' as instruction;
