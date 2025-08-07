-- Clean Open Block Records Script
-- This script safely removes all open block related records while preserving existing care blocks

-- First, let's check what we have before cleaning
SELECT '=== BEFORE CLEANUP ===' as info;

-- Check current open block invitations
SELECT 
    'OPEN_BLOCK_INVITATIONS' as table_name,
    COUNT(*) as total_count,
    status,
    COUNT(*) as status_count
FROM open_block_invitations 
GROUP BY status;

-- Check current open block responses
SELECT 
    'OPEN_BLOCK_RESPONSES' as table_name,
    COUNT(*) as total_count,
    response,
    COUNT(*) as response_count
FROM open_block_responses 
GROUP BY response;

-- Check scheduled_care_children that were created by open block acceptance
SELECT 
    'SCHEDULED_CARE_CHILDREN (Open Block)' as table_name,
    COUNT(*) as count
FROM scheduled_care_children 
WHERE notes LIKE '%Open block acceptance%';

-- Check scheduled_care blocks that were created by open block acceptance
SELECT 
    'SCHEDULED_CARE (Open Block)' as table_name,
    COUNT(*) as count
FROM scheduled_care 
WHERE notes LIKE '%Open block acceptance%';

-- Now let's clean up the records
SELECT '=== CLEANING UP ===' as info;

-- 1. Delete all open block responses (this will trigger cascade to clean up related records)
DELETE FROM open_block_responses;

-- 2. Delete all open block invitations
DELETE FROM open_block_invitations;

-- 3. Remove scheduled_care_children entries that were created by open block acceptance
DELETE FROM scheduled_care_children 
WHERE notes LIKE '%Open block acceptance%';

-- 4. Remove scheduled_care blocks that were created by open block acceptance
DELETE FROM scheduled_care 
WHERE notes LIKE '%Open block acceptance%';

-- 5. Clean up any orphaned scheduled_care_children (children without a parent care block)
DELETE FROM scheduled_care_children 
WHERE scheduled_care_id NOT IN (
    SELECT id FROM scheduled_care
);

-- Now let's verify the cleanup
SELECT '=== AFTER CLEANUP ===' as info;

-- Check remaining open block invitations
SELECT 
    'OPEN_BLOCK_INVITATIONS' as table_name,
    COUNT(*) as total_count
FROM open_block_invitations;

-- Check remaining open block responses
SELECT 
    'OPEN_BLOCK_RESPONSES' as table_name,
    COUNT(*) as total_count
FROM open_block_responses;

-- Check remaining scheduled_care_children (should only be from non-open-block sources)
SELECT 
    'SCHEDULED_CARE_CHILDREN (Remaining)' as table_name,
    COUNT(*) as count
FROM scheduled_care_children;

-- Check remaining scheduled_care blocks (should preserve reciprocal blocks)
SELECT 
    'SCHEDULED_CARE (Remaining)' as table_name,
    COUNT(*) as count,
    care_type,
    status
FROM scheduled_care 
GROUP BY care_type, status;

-- Show remaining scheduled_care blocks with their notes to verify they're not open block related
SELECT 
    'REMAINING CARE BLOCKS' as info,
    id,
    parent_id,
    child_id,
    care_date,
    start_time,
    end_time,
    care_type,
    status,
    notes,
    created_at
FROM scheduled_care 
ORDER BY created_at DESC 
LIMIT 10;

-- Success message
SELECT 'Open block records cleaned successfully! You can now test the fixed trigger.' as status;
