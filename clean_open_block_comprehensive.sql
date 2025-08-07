-- Comprehensive Clean Open Block Records Script
-- This script safely removes all open block related records with additional safety checks

-- First, let's create a backup of what we're about to delete
SELECT '=== CREATING BACKUP QUERIES ===' as info;

-- Backup of open block invitations
SELECT 
    'BACKUP: OPEN_BLOCK_INVITATIONS' as backup_info,
    id,
    open_block_id,
    invited_parent_id,
    accepted_parent_id,
    status,
    created_at,
    updated_at
FROM open_block_invitations;

-- Backup of open block responses
SELECT 
    'BACKUP: OPEN_BLOCK_RESPONSES' as backup_info,
    id,
    invitation_id,
    parent_id,
    response,
    child_id,
    notes,
    created_at
FROM open_block_responses;

-- Backup of scheduled_care_children that will be deleted
SELECT 
    'BACKUP: SCHEDULED_CARE_CHILDREN (To Delete)' as backup_info,
    id,
    scheduled_care_id,
    child_id,
    providing_parent_id,
    notes,
    created_at
FROM scheduled_care_children 
WHERE notes LIKE '%Open block acceptance%';

-- Backup of scheduled_care blocks that will be deleted
SELECT 
    'BACKUP: SCHEDULED_CARE (To Delete)' as backup_info,
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
WHERE notes LIKE '%Open block acceptance%';

-- Now let's check what we have before cleaning
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

-- Check what will remain (non-open-block care blocks)
SELECT 
    'SCHEDULED_CARE (Will Remain)' as table_name,
    COUNT(*) as count,
    care_type,
    status
FROM scheduled_care 
WHERE notes NOT LIKE '%Open block acceptance%' OR notes IS NULL
GROUP BY care_type, status;

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

-- Show remaining scheduled_care_children to verify they're not open block related
SELECT 
    'REMAINING CARE CHILDREN' as info,
    id,
    scheduled_care_id,
    child_id,
    providing_parent_id,
    notes,
    created_at
FROM scheduled_care_children 
ORDER BY created_at DESC 
LIMIT 10;

-- Verify trigger still exists
SELECT 
    'TRIGGER STATUS' as info,
    trigger_name,
    event_manipulation,
    event_object_table,
    action_timing
FROM information_schema.triggers 
WHERE trigger_name = 'handle_open_block_acceptance_trigger';

-- Success message
SELECT 'Open block records cleaned successfully! You can now test the fixed trigger.' as status;
