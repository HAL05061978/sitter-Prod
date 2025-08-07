-- Comprehensive Calendar Data Cleanup Script
-- This script removes all calendar-related records while preserving fundamental functionality
-- (profiles, children, groups, etc.)

-- Start transaction for safety
BEGIN;

-- 1. Clean up Open Block related data
DELETE FROM open_block_responses;
DELETE FROM open_block_invitations;

-- 2. Clean up Care Responses
DELETE FROM care_responses;

-- 3. Clean up Care Requests (all types: simple, reciprocal, event, open_block)
DELETE FROM care_requests;

-- 4. Clean up Group Invitations
DELETE FROM group_invitations;

-- 5. Clean up Event Responses
DELETE FROM event_responses;

-- 6. Clean up Event Notifications
DELETE FROM event_notifications;

-- 7. Clean up Messages (keep only non-calendar related messages)
DELETE FROM messages 
WHERE subject LIKE '%Open Block%' 
   OR subject LIKE '%Care Request%' 
   OR subject LIKE '%Invitation%' 
   OR subject LIKE '%Event%'
   OR subject LIKE '%Reciprocal%'
   OR content LIKE '%Open Block%'
   OR content LIKE '%Care Request%'
   OR content LIKE '%Invitation%'
   OR content LIKE '%Event%'
   OR content LIKE '%Reciprocal%';

-- 8. Clean up Scheduled Care Children (children assigned to care blocks)
DELETE FROM scheduled_care_children;

-- 9. Clean up Scheduled Care (the actual calendar blocks)
DELETE FROM scheduled_care;

-- 10. Clean up any orphaned group members (optional - uncomment if needed)
-- DELETE FROM group_members WHERE group_id NOT IN (SELECT id FROM groups);

-- Verify cleanup results
SELECT 'Open Block Responses' as table_name, COUNT(*) as remaining_records FROM open_block_responses
UNION ALL
SELECT 'Open Block Invitations', COUNT(*) FROM open_block_invitations
UNION ALL
SELECT 'Care Responses', COUNT(*) FROM care_responses
UNION ALL
SELECT 'Care Requests', COUNT(*) FROM care_requests
UNION ALL
SELECT 'Group Invitations', COUNT(*) FROM group_invitations
UNION ALL
SELECT 'Event Responses', COUNT(*) FROM event_responses
UNION ALL
SELECT 'Event Notifications', COUNT(*) FROM event_notifications
UNION ALL
SELECT 'Scheduled Care Children', COUNT(*) FROM scheduled_care_children
UNION ALL
SELECT 'Scheduled Care', COUNT(*) FROM scheduled_care;

-- Show preserved data counts
SELECT 'Profiles' as preserved_table, COUNT(*) as record_count FROM profiles
UNION ALL
SELECT 'Children', COUNT(*) FROM children
UNION ALL
SELECT 'Groups', COUNT(*) FROM groups
UNION ALL
SELECT 'Group Members', COUNT(*) FROM group_members
UNION ALL
SELECT 'Messages (non-calendar)', COUNT(*) FROM messages;

-- Commit the transaction
COMMIT;

-- Display summary
SELECT 'Calendar data cleanup completed successfully!' as status;
