-- Clear ALL scheduling, invitation, and calendar records for fresh testing
-- This will completely reset your schedule data

-- ============================================================================
-- STEP 1: SHOW CURRENT STATE BEFORE CLEARING
-- ============================================================================

SELECT '=== BEFORE CLEARING - CURRENT RECORD COUNTS ===' as info;

-- Check current record counts
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
    requested_date,
    start_time,
    end_time,
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
    reciprocal_date,
    reciprocal_start_time,
    reciprocal_end_time,
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
    related_request_id,
    created_at
FROM scheduled_care 
ORDER BY created_at DESC 
LIMIT 5;

-- ============================================================================
-- STEP 2: CLEAR ALL RECORDS IN THE CORRECT ORDER
-- ============================================================================

SELECT '=== CLEARING ALL RECORDS ===' as info;

-- Clear care responses first (they reference care_requests)
DELETE FROM care_responses;

-- Clear care requests
DELETE FROM care_requests;

-- Clear scheduled care (these are the calendar entries)
DELETE FROM scheduled_care;

-- ============================================================================
-- STEP 3: VERIFY CLEARING WAS SUCCESSFUL
-- ============================================================================

SELECT '=== AFTER CLEARING - VERIFICATION ===' as info;

-- Check record counts AFTER clearing
SELECT 'Care Requests' as table_name, COUNT(*) as count FROM care_requests;
SELECT 'Care Responses' as table_name, COUNT(*) as count FROM care_responses;
SELECT 'Scheduled Care' as table_name, COUNT(*) as count FROM scheduled_care;

-- Verify everything is cleared
SELECT 
    CASE 
        WHEN (SELECT COUNT(*) FROM care_requests) = 0 
         AND (SELECT COUNT(*) FROM care_responses) = 0
         AND (SELECT COUNT(*) FROM scheduled_care) = 0
        THEN '✅ SUCCESS: All schedule records cleared'
        ELSE '❌ FAIL: Some records still exist'
    END as status;

-- ============================================================================
-- STEP 4: FINAL CONFIRMATION
-- ============================================================================

SELECT '🎉 All scheduling, invitation, and calendar records have been cleared!' as note;
SELECT 'Your calendar should now be completely empty and ready for fresh testing.' as note;
SELECT 'You can now test the reciprocal request flow from scratch.' as note;

-- ============================================================================
-- STEP 5: TESTING INSTRUCTIONS
-- ============================================================================

SELECT '=== NEXT STEPS FOR TESTING ===' as info;
SELECT '1. Create a reciprocal request as Parent A' as step;
SELECT '2. Have Parent B respond with reciprocal care times' as step;
SELECT '3. Verify Parent A can see and accept the response' as step;
SELECT '4. Check that both initial and reciprocal time blocks appear in calendar' as step;
SELECT '5. Verify multiple parents can respond until Parent A chooses one' as step; 