-- Clear ALL scheduling, invitation, and calendar records for fresh testing
-- This will completely reset your schedule data

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

-- Check current record counts BEFORE clearing
SELECT '=== BEFORE CLEARING ===' as info;
SELECT 'Care Requests' as table_name, COUNT(*) as count FROM care_requests;
SELECT 'Care Responses' as table_name, COUNT(*) as count FROM care_responses;
SELECT 'Scheduled Care' as table_name, COUNT(*) as count FROM scheduled_care;

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

SELECT '=== SAMPLE SCHEDULED CARE (CALENDAR ENTRIES) ===' as info;
SELECT 
    id,
    group_id,
    parent_id,
    child_id,
    care_date,
    start_time,
    end_time,
    care_type,
    status,
    created_at
FROM scheduled_care 
ORDER BY created_at DESC 
LIMIT 5;

-- Clear all records in the correct order (respecting foreign key constraints)
SELECT '=== CLEARING RECORDS ===' as info;

-- Clear care responses first (they reference care_requests)
DELETE FROM care_responses;

-- Clear care requests
DELETE FROM care_requests;

-- Clear scheduled care (these are the calendar entries)
DELETE FROM scheduled_care;

-- Check record counts AFTER clearing
SELECT '=== AFTER CLEARING ===' as info;
SELECT 'Care Requests' as table_name, COUNT(*) as count FROM care_requests;
SELECT 'Care Responses' as table_name, COUNT(*) as count FROM care_responses;
SELECT 'Scheduled Care' as table_name, COUNT(*) as count FROM scheduled_care;

-- Verify everything is cleared
SELECT '=== VERIFICATION ===' as info;
SELECT 
    CASE 
        WHEN (SELECT COUNT(*) FROM care_requests) = 0 
         AND (SELECT COUNT(*) FROM care_responses) = 0
         AND (SELECT COUNT(*) FROM scheduled_care) = 0
        THEN '✅ SUCCESS: All schedule records cleared'
        ELSE '❌ FAIL: Some records still exist'
    END as status;

SELECT '🎉 All scheduling, invitation, and calendar records have been cleared!' as note;
SELECT 'Your calendar should now be completely empty and ready for fresh testing.' as note; 