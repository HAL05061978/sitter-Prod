-- COMPREHENSIVE CLEANUP: Clear ALL invitation types and related calendar blocks
-- This script removes all invitation data and their calendar entries
-- Use this for fresh testing of all invitation workflows

-- Show what will be deleted BEFORE deletion
SELECT '=== CURRENT DATA BEFORE CLEANUP ===' as info;

-- Count records that will be deleted
SELECT 'Records to be deleted:' as info;
SELECT 'open_block_responses: ' || COUNT(*) as count FROM open_block_responses;
SELECT 'open_block_invitations: ' || COUNT(*) as count FROM open_block_invitations;
SELECT 'care_responses: ' || COUNT(*) as count FROM care_responses;
SELECT 'care_requests (reciprocal): ' || COUNT(*) as count FROM care_requests WHERE request_type = 'reciprocal';
SELECT 'care_requests (event): ' || COUNT(*) as count FROM care_requests WHERE request_type = 'event';
SELECT 'care_requests (open_block): ' || COUNT(*) as count FROM care_requests WHERE request_type = 'open_block';
SELECT 'group_invitations: ' || COUNT(*) as count FROM group_invitations;
SELECT 'scheduled_care (open block notes): ' || COUNT(*) as count FROM scheduled_care WHERE notes LIKE '%Open block%';
SELECT 'scheduled_care (reciprocal notes): ' || COUNT(*) as count FROM scheduled_care WHERE notes LIKE '%reciprocal%';
SELECT 'scheduled_care (event notes): ' || COUNT(*) as count FROM scheduled_care WHERE notes LIKE '%event%';
SELECT 'scheduled_care_children (open block): ' || COUNT(*) as count FROM scheduled_care_children WHERE notes LIKE '%Open block%';

SELECT '=== STARTING CLEANUP ===' as info;

-- 1. Clear open block responses first (child table)
DELETE FROM open_block_responses;
SELECT 'Deleted all open_block_responses' as status;

-- 2. Clear open block invitations
DELETE FROM open_block_invitations;
SELECT 'Deleted all open_block_invitations' as status;

-- 3. Clear care responses (for all request types)
DELETE FROM care_responses;
SELECT 'Deleted all care_responses' as status;

-- 4. Clear scheduled_care_children entries for invitation-related blocks
DELETE FROM scheduled_care_children 
WHERE notes LIKE '%Open block%' 
   OR notes LIKE '%reciprocal%' 
   OR notes LIKE '%event%'
   OR scheduled_care_id IN (
       SELECT id FROM scheduled_care 
       WHERE notes LIKE '%Open block%' 
          OR notes LIKE '%reciprocal%' 
          OR notes LIKE '%event%'
   );
SELECT 'Deleted invitation-related scheduled_care_children entries' as status;

-- 5. Clear scheduled_care entries for invitation-related blocks
DELETE FROM scheduled_care 
WHERE notes LIKE '%Open block%' 
   OR notes LIKE '%reciprocal%' 
   OR notes LIKE '%event%'
   OR related_request_id IN (
       SELECT id FROM care_requests 
       WHERE request_type IN ('reciprocal', 'event', 'open_block')
   );
SELECT 'Deleted invitation-related scheduled_care entries' as status;

-- 6. Clear care_requests for invitation types
DELETE FROM care_requests 
WHERE request_type IN ('reciprocal', 'event', 'open_block');
SELECT 'Deleted care_requests for invitation types' as status;

-- 7. Clear group invitations (if they exist)
DELETE FROM group_invitations;
SELECT 'Deleted all group_invitations' as status;

-- Show final counts
SELECT '=== CLEANUP COMPLETE ===' as info;
SELECT 'Remaining records:' as info;
SELECT 'open_block_responses: ' || COUNT(*) as remaining FROM open_block_responses;
SELECT 'open_block_invitations: ' || COUNT(*) as remaining FROM open_block_invitations;
SELECT 'care_responses: ' || COUNT(*) as remaining FROM care_responses;
SELECT 'care_requests (reciprocal): ' || COUNT(*) as remaining FROM care_requests WHERE request_type = 'reciprocal';
SELECT 'care_requests (event): ' || COUNT(*) as remaining FROM care_requests WHERE request_type = 'event';
SELECT 'care_requests (open_block): ' || COUNT(*) as remaining FROM care_requests WHERE request_type = 'open_block';
SELECT 'group_invitations: ' || COUNT(*) as remaining FROM group_invitations;
SELECT 'scheduled_care (invitation notes): ' || COUNT(*) as remaining FROM scheduled_care WHERE notes LIKE '%Open block%' OR notes LIKE '%reciprocal%' OR notes LIKE '%event%';

SELECT '=== ALL INVITATION DATA CLEARED ===' as final_status;
SELECT 'You can now test fresh invitation workflows!' as message;
