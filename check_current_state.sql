-- Check Current State
-- This script will show us the current state of open block invitations and responses

-- 1. Check all open block invitations
SELECT '=== ALL OPEN BLOCK INVITATIONS ===' as info;

SELECT 
    id,
    open_block_id,
    invited_parent_id,
    accepted_parent_id,
    status,
    created_at,
    updated_at
FROM open_block_invitations 
ORDER BY created_at DESC;

-- 2. Check all open block responses
SELECT '=== ALL OPEN BLOCK RESPONSES ===' as info;

SELECT 
    id,
    invitation_id,
    parent_id,
    response,
    child_id,
    notes,
    created_at
FROM open_block_responses 
ORDER BY created_at DESC;

-- 3. Find invitations that haven't been responded to by the test parent
SELECT '=== AVAILABLE INVITATIONS FOR TESTING ===' as info;

SELECT 
    obi.id as invitation_id,
    obi.invited_parent_id,
    obi.status,
    obi.created_at,
    -- Check if this parent has already responded
    CASE 
        WHEN obr.id IS NOT NULL THEN 'Already responded'
        ELSE 'No response yet'
    END as response_status
FROM open_block_invitations obi
LEFT JOIN open_block_responses obr ON obi.id = obr.invitation_id 
    AND obr.parent_id = '8c7b93f6-582d-4208-9cdd-65a940a1d18d'
WHERE obi.status = 'active'
ORDER BY obi.created_at DESC;

-- 4. Check if the trigger exists and is enabled
SELECT '=== TRIGGER STATUS ===' as info;

SELECT 
    trigger_name,
    event_manipulation,
    event_object_table,
    action_timing,
    action_statement
FROM information_schema.triggers 
WHERE trigger_name = 'handle_open_block_acceptance_trigger';

-- 5. Check if the function exists
SELECT '=== FUNCTION STATUS ===' as info;

SELECT 
    routine_name,
    routine_type
FROM information_schema.routines 
WHERE routine_name = 'handle_open_block_acceptance';

-- 6. Check trigger enable status
SELECT '=== TRIGGER ENABLE STATUS ===' as info;

SELECT 
    tgname as trigger_name,
    tgenabled as enabled,
    tgrelid::regclass as table_name
FROM pg_trigger 
WHERE tgname = 'handle_open_block_acceptance_trigger';
