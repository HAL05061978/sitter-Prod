-- Clear Scheduling Records (Safe)
-- This script clears ONLY scheduling-related records from the new 3-table system
-- WITHOUT affecting core app data (profiles, children, groups, etc.)

-- ============================================================================
-- STEP 1: SHOW CURRENT RECORD COUNTS
-- ============================================================================

SELECT 'Current record counts BEFORE cleanup:' as info;
SELECT 'Care Requests:' as table_name, COUNT(*) as count FROM public.care_requests
UNION ALL
SELECT 'Scheduled Care:' as table_name, COUNT(*) as count FROM public.scheduled_care
UNION ALL
SELECT 'Care Responses:' as table_name, COUNT(*) as count FROM public.care_responses;

-- ============================================================================
-- STEP 2: CLEAR SCHEDULING RECORDS IN CORRECT ORDER
-- ============================================================================

-- Clear care_responses first (they reference care_requests)
DELETE FROM public.care_responses;
SELECT '✅ Cleared care_responses table' as status;

-- Clear scheduled_care (they can reference care_requests)
DELETE FROM public.scheduled_care;
SELECT '✅ Cleared scheduled_care table' as status;

-- Clear care_requests (main table)
DELETE FROM public.care_requests;
SELECT '✅ Cleared care_requests table' as status;

-- ============================================================================
-- STEP 3: VERIFY CLEANUP
-- ============================================================================

SELECT 'Record counts AFTER cleanup:' as info;
SELECT 'Care Requests:' as table_name, COUNT(*) as count FROM public.care_requests
UNION ALL
SELECT 'Scheduled Care:' as table_name, COUNT(*) as count FROM public.scheduled_care
UNION ALL
SELECT 'Care Responses:' as table_name, COUNT(*) as count FROM public.care_responses;

-- ============================================================================
-- STEP 4: VERIFY CORE APP DATA IS INTACT
-- ============================================================================

SELECT 'Verifying core app data is intact:' as info;
SELECT 'Profiles:' as table_name, COUNT(*) as count FROM public.profiles
UNION ALL
SELECT 'Children:' as table_name, COUNT(*) as count FROM public.children
UNION ALL
SELECT 'Groups:' as table_name, COUNT(*) as count FROM public.groups
UNION ALL
SELECT 'Group Members:' as table_name, COUNT(*) as count FROM public.group_members
UNION ALL
SELECT 'Child Group Members:' as table_name, COUNT(*) as count FROM public.child_group_members;

-- ============================================================================
-- STEP 5: SHOW TABLE STRUCTURE STATUS
-- ============================================================================

SELECT 'Scheduling tables structure (should be intact):' as info;
SELECT 
    table_name,
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = table_name AND table_schema = 'public') 
         THEN '✅ EXISTS' 
         ELSE '❌ MISSING' 
    END as status
FROM (VALUES 
    ('care_requests'),
    ('scheduled_care'),
    ('care_responses')
) as t(table_name);

-- ============================================================================
-- STEP 6: FINAL STATUS
-- ============================================================================

SELECT '✅ Scheduling records cleared successfully!' as status;
SELECT 'All scheduling tables are now empty and ready for fresh testing' as result;
SELECT 'Core app data (profiles, children, groups) remains intact' as note;
SELECT 'Ready to start testing from scratch!' as next_step; 