-- Clear all invitation-related records for fresh testing
-- This will help us trace exactly what's happening with the auto-approval

-- First, let's see what tables actually exist
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
ORDER BY table_name;

-- Check what records exist before clearing (only for tables that exist)
SELECT 'BEFORE CLEARING - Care Requests' as info, COUNT(*) as count FROM care_requests;
SELECT 'BEFORE CLEARING - Care Responses' as info, COUNT(*) as count FROM care_responses;

-- Show some sample records to understand the current state
SELECT 'Sample Care Requests' as info, id, requester_id, status, created_at 
FROM care_requests 
ORDER BY created_at DESC 
LIMIT 5;

SELECT 'Sample Care Responses' as info, id, request_id, responder_id, status, response_notes, created_at 
FROM care_responses 
ORDER BY created_at DESC 
LIMIT 5;

-- Clear all care responses (this is where invitation responses are stored)
DELETE FROM care_responses;

-- Clear all care requests (this will also clear any related data)
DELETE FROM care_requests;

-- Check what's left after clearing
SELECT 'AFTER CLEARING - Care Requests' as info, COUNT(*) as count FROM care_requests;
SELECT 'AFTER CLEARING - Care Responses' as info, COUNT(*) as count FROM care_responses;

SELECT 'All invitation-related records have been cleared. Ready for fresh testing.' as note; 