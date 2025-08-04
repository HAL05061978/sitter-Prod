-- Clear all invitation-related records for fresh testing
-- This will help us trace exactly what's happening with the auto-approval

-- First, let's see what records exist before clearing
SELECT 'BEFORE CLEARING - Care Responses' as info, COUNT(*) as count FROM care_responses;
SELECT 'BEFORE CLEARING - Scheduled Blocks' as info, COUNT(*) as count FROM scheduled_blocks;
SELECT 'BEFORE CLEARING - Care Requests' as info, COUNT(*) as count FROM care_requests;

-- Show some sample records to understand the current state
SELECT 'Sample Care Responses' as info, id, request_id, responder_id, status, response_notes, created_at 
FROM care_responses 
ORDER BY created_at DESC 
LIMIT 5;

SELECT 'Sample Scheduled Blocks' as info, id, request_id, parent_id, child_id, block_type, status, notes 
FROM scheduled_blocks 
ORDER BY created_at DESC 
LIMIT 5;

-- Clear all invitation-related records
-- Start with the most dependent tables first

-- 1. Clear scheduled blocks (these are created when invitations are accepted)
DELETE FROM scheduled_blocks 
WHERE notes LIKE '%invitation%' 
   OR notes LIKE '%Invitation%'
   OR notes LIKE '%reciprocal%'
   OR notes LIKE '%Reciprocal%'
   OR notes LIKE '%accepted invitation response%'
   OR notes LIKE '%Reciprocal care via accepted invitation response%';

-- 2. Clear care responses that are invitation-related
DELETE FROM care_responses 
WHERE response_notes LIKE '%Inviter:%'
   OR response_notes LIKE '%Invitation ID:%'
   OR response_notes LIKE '%Time Block:%'
   OR response_notes LIKE '%invitation%'
   OR response_notes LIKE '%Invitation%';

-- 3. Clear care requests that are invitation-related (open blocks, etc.)
DELETE FROM care_requests 
WHERE request_type = 'open_block'
   OR notes LIKE '%invitation%'
   OR notes LIKE '%Invitation%'
   OR notes LIKE '%reciprocal%'
   OR notes LIKE '%Reciprocal%';

-- Show what's left after clearing
SELECT 'AFTER CLEARING - Care Responses' as info, COUNT(*) as count FROM care_responses;
SELECT 'AFTER CLEARING - Scheduled Blocks' as info, COUNT(*) as count FROM scheduled_blocks;
SELECT 'AFTER CLEARING - Care Requests' as info, COUNT(*) as count FROM care_requests;

-- Show remaining records to verify what's left
SELECT 'Remaining Care Responses' as info, id, request_id, responder_id, status, response_notes, created_at 
FROM care_responses 
ORDER BY created_at DESC 
LIMIT 5;

SELECT 'Remaining Scheduled Blocks' as info, id, request_id, parent_id, child_id, block_type, status, notes 
FROM scheduled_blocks 
ORDER BY created_at DESC 
LIMIT 5;

-- Check if there are any triggers that might still be active
SELECT 'Active Triggers' as info, trigger_name, event_object_table, event_manipulation
FROM information_schema.triggers 
WHERE event_object_table IN ('care_responses', 'scheduled_blocks', 'care_requests');

-- Check if there are any functions that might be auto-accepting
SELECT 'Functions that might auto-accept' as info, routine_name, routine_type
FROM information_schema.routines 
WHERE routine_name LIKE '%accept%'
   OR routine_name LIKE '%response%'
   OR routine_name LIKE '%invitation%'
   OR routine_name LIKE '%care%'
   OR routine_name LIKE '%exchange%'
ORDER BY routine_name;

SELECT 'All invitation-related records have been cleared. Ready for fresh testing.' as note; 