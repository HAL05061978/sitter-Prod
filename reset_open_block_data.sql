-- Reset Open Block Data
-- This script completely resets all open block data to start fresh

-- 1. Remove the broken trigger
SELECT '=== REMOVING BROKEN TRIGGER ===' as info;

DROP TRIGGER IF EXISTS handle_open_block_acceptance_trigger ON open_block_responses;
DROP FUNCTION IF EXISTS handle_open_block_acceptance();

-- 2. Clean up ALL open block responses
SELECT '=== CLEANING UP ALL OPEN BLOCK RESPONSES ===' as info;

DELETE FROM open_block_responses;

-- 3. Reset ALL invitation statuses to active
SELECT '=== RESETTING ALL INVITATION STATUSES ===' as info;

UPDATE open_block_invitations 
SET 
    status = 'active',
    accepted_parent_id = NULL,
    updated_at = NOW();

-- 4. Clean up any care blocks created by open block acceptance
SELECT '=== CLEANING UP OPEN BLOCK CARE BLOCKS ===' as info;

DELETE FROM scheduled_care_children 
WHERE notes LIKE '%Open block acceptance%';

DELETE FROM scheduled_care 
WHERE notes LIKE '%Open block acceptance%';

-- 5. Verify the cleanup
SELECT '=== VERIFICATION ===' as info;

-- Check invitation statuses
SELECT 
    'INVITATIONS' as table_name,
    COUNT(*) as total_count,
    status,
    COUNT(*) as status_count
FROM open_block_invitations 
GROUP BY status;

-- Check responses
SELECT 
    'RESPONSES' as table_name,
    COUNT(*) as total_count
FROM open_block_responses;

-- Check care blocks
SELECT 
    'CARE BLOCKS' as table_name,
    COUNT(*) as total_count
FROM scheduled_care 
WHERE notes LIKE '%Open block acceptance%';

-- Check care children
SELECT 
    'CARE CHILDREN' as table_name,
    COUNT(*) as total_count
FROM scheduled_care_children 
WHERE notes LIKE '%Open block acceptance%';

-- 6. Show current invitations ready for testing
SELECT '=== CURRENT INVITATIONS READY FOR TESTING ===' as info;

SELECT 
    id,
    open_block_id,
    invited_parent_id,
    status,
    created_at
FROM open_block_invitations 
ORDER BY created_at DESC
LIMIT 5;

-- 7. Success message
SELECT '=== READY FOR TESTING ===' as info;
SELECT 'All open block data has been reset. You can now test the fixed acceptance logic.' as status;
