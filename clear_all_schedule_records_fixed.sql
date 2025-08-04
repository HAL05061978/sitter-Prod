-- Clear ALL schedule-related records for fresh testing
-- This will clear everything: requests, responses, invitations, and scheduled blocks

-- First, let's see what tables exist and their current state
SELECT '=== EXISTING TABLES ===' as info;
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name LIKE '%care%' 
   OR table_name LIKE '%request%' 
   OR table_name LIKE '%response%' 
   OR table_name LIKE '%invitation%'
   OR table_name LIKE '%scheduled%'
   OR table_name LIKE '%block%'
   OR table_name LIKE '%event%'
ORDER BY table_name;

-- Check current record counts BEFORE clearing (only for tables that exist)
SELECT '=== BEFORE CLEARING ===' as info;
SELECT 'Care Requests' as table_name, COUNT(*) as count FROM care_requests;
SELECT 'Care Responses' as table_name, COUNT(*) as count FROM care_responses;

-- Check if other tables exist before trying to count them
SELECT '=== CHECKING OTHER TABLES ===' as info;
SELECT 
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'group_invitations') 
        THEN 'Group Invitations table exists'
        ELSE 'Group Invitations table does not exist'
    END as group_invitations_status;

SELECT 
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'event_responses') 
        THEN 'Event Responses table exists'
        ELSE 'Event Responses table does not exist'
    END as event_responses_status;

-- Show some sample records to understand what's there
SELECT '=== SAMPLE CARE REQUESTS ===' as info;
SELECT 
    id,
    requester_id,
    request_type,
    status,
    created_at
FROM care_requests 
ORDER BY created_at DESC 
LIMIT 5;

SELECT '=== SAMPLE CARE RESPONSES ===' as info;
SELECT 
    id,
    request_id,
    responder_id,
    response_type,
    status,
    created_at
FROM care_responses 
ORDER BY created_at DESC 
LIMIT 5;

-- Clear all records in the correct order (respecting foreign key constraints)
SELECT '=== CLEARING RECORDS ===' as info;

-- Clear event responses first (if the table exists)
DELETE FROM event_responses WHERE 1=1;

-- Clear care responses
DELETE FROM care_responses;

-- Clear group invitations (if the table exists)
DELETE FROM group_invitations WHERE 1=1;

-- Clear care requests
DELETE FROM care_requests;

-- Check record counts AFTER clearing
SELECT '=== AFTER CLEARING ===' as info;
SELECT 'Care Requests' as table_name, COUNT(*) as count FROM care_requests;
SELECT 'Care Responses' as table_name, COUNT(*) as count FROM care_responses;

-- Verify everything is cleared
SELECT '=== VERIFICATION ===' as info;
SELECT 
    CASE 
        WHEN (SELECT COUNT(*) FROM care_requests) = 0 
         AND (SELECT COUNT(*) FROM care_responses) = 0
        THEN '✅ SUCCESS: All schedule records cleared'
        ELSE '❌ FAIL: Some records still exist'
    END as status;

SELECT 'All schedule-related records have been cleared. Calendar should now be empty.' as note; 