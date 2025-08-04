-- Clear All Scheduling and Calendar Records
-- This script will clear all care-related data for fresh testing

-- First, let's see what we have before clearing
SELECT 'BEFORE CLEARING - Care Requests' as info, COUNT(*) as count FROM care_requests;
SELECT 'BEFORE CLEARING - Care Responses' as info, COUNT(*) as count FROM care_responses;
SELECT 'BEFORE CLEARING - Scheduled Care' as info, COUNT(*) as count FROM scheduled_care;

-- Clear in the correct order (respecting foreign key constraints)
-- 1. Clear care responses first (they reference care_requests)
DELETE FROM care_responses WHERE 1=1;

-- 2. Clear scheduled care (they reference care_requests)
DELETE FROM scheduled_care WHERE 1=1;

-- 3. Clear care requests
DELETE FROM care_requests WHERE 1=1;

-- Verify everything is cleared
SELECT 'AFTER CLEARING - Care Requests' as info, COUNT(*) as count FROM care_requests;
SELECT 'AFTER CLEARING - Care Responses' as info, COUNT(*) as count FROM care_responses;
SELECT 'AFTER CLEARING - Scheduled Care' as info, COUNT(*) as count FROM scheduled_care;

SELECT 'All scheduling records have been cleared successfully!' as status; 