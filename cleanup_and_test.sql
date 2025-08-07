-- Cleanup and Test
-- This script removes the broken trigger and cleans up test data

-- 1. Remove the broken trigger
SELECT '=== REMOVING BROKEN TRIGGER ===' as info;

DROP TRIGGER IF EXISTS handle_open_block_acceptance_trigger ON open_block_responses;
DROP FUNCTION IF EXISTS handle_open_block_acceptance();

-- 2. Clean up test responses
SELECT '=== CLEANING UP TEST RESPONSES ===' as info;

DELETE FROM open_block_responses 
WHERE notes LIKE '%Test trigger response%'
   OR notes LIKE '%Test trigger response - new invitation%'
   OR notes LIKE '%Test trigger response - fixed trigger%';

-- 3. Reset invitation statuses to active
SELECT '=== RESETTING INVITATION STATUSES ===' as info;

UPDATE open_block_invitations 
SET 
    status = 'active',
    accepted_parent_id = NULL,
    updated_at = NOW()
WHERE status IN ('accepted', 'expired');

-- 4. Clean up any test care blocks
SELECT '=== CLEANING UP TEST CARE BLOCKS ===' as info;

DELETE FROM scheduled_care_children 
WHERE notes LIKE '%Open block acceptance%'
   AND created_at > NOW() - INTERVAL '1 hour';

DELETE FROM scheduled_care 
WHERE notes LIKE '%Open block acceptance%'
   AND created_at > NOW() - INTERVAL '1 hour';

-- 5. Verify cleanup
SELECT '=== VERIFICATION ===' as info;

-- Check invitation statuses
SELECT 
    id,
    status,
    accepted_parent_id,
    updated_at
FROM open_block_invitations 
ORDER BY created_at DESC
LIMIT 5;

-- Check responses
SELECT 
    id,
    invitation_id,
    parent_id,
    response,
    notes,
    created_at
FROM open_block_responses 
ORDER BY created_at DESC
LIMIT 5;

-- Check care blocks
SELECT 
    COUNT(*) as care_blocks_count
FROM scheduled_care 
WHERE notes LIKE '%Open block acceptance%';

-- Check care children
SELECT 
    COUNT(*) as care_children_count
FROM scheduled_care_children 
WHERE notes LIKE '%Open block acceptance%';

-- 6. Test the new frontend logic
SELECT '=== READY FOR FRONTEND TESTING ===' as info;
SELECT 'The broken trigger has been removed and test data cleaned up.' as status;
SELECT 'You can now test the open block acceptance using the frontend.' as instruction;

