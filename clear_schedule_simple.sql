-- ============================================================================
-- SIMPLE CLEAR SCHEDULE DATA SCRIPT
-- ============================================================================
-- This script clears only the current scheduling tables
-- (care_requests and scheduled_care)

-- ============================================================================
-- STEP 1: CLEAR CURRENT SCHEDULING DATA
-- ============================================================================

-- Clear all care requests
DELETE FROM public.care_requests;

-- Clear all scheduled care blocks
DELETE FROM public.scheduled_care;

-- ============================================================================
-- STEP 2: VERIFICATION
-- ============================================================================

-- Show record counts for verification
SELECT 
    'Care Requests' as table_name,
    COUNT(*) as record_count
FROM public.care_requests
UNION ALL
SELECT 
    'Scheduled Care' as table_name,
    COUNT(*) as record_count
FROM public.scheduled_care;

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================

SELECT 
    CASE 
        WHEN (SELECT COUNT(*) FROM public.care_requests) = 0 
         AND (SELECT COUNT(*) FROM public.scheduled_care) = 0
        THEN '✅ Schedule data cleared successfully!'
        ELSE '❌ Some schedule data may still exist'
    END as status; 