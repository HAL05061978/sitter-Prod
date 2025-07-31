-- ============================================================================
-- CLEAR SCHEDULE DATA SCRIPT
-- ============================================================================
-- This script safely clears all schedule-related records while preserving
-- fundamental app data (profiles, groups, children, messages, etc.)

-- WARNING: This will permanently delete all scheduling data
-- Make sure you have backups if needed before running this script

-- ============================================================================
-- STEP 1: CLEAR SCHEDULED CARE RECORDS
-- ============================================================================

-- Clear all scheduled care blocks
DELETE FROM public.scheduled_care;

-- Reset the sequence if it exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.sequences WHERE sequence_name = 'scheduled_care_id_seq') THEN
        ALTER SEQUENCE public.scheduled_care_id_seq RESTART WITH 1;
    END IF;
END $$;

-- ============================================================================
-- STEP 2: CLEAR CARE REQUESTS RECORDS
-- ============================================================================

-- Clear all care requests
DELETE FROM public.care_requests;

-- Reset the sequence if it exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.sequences WHERE sequence_name = 'care_requests_id_seq') THEN
        ALTER SEQUENCE public.care_requests_id_seq RESTART WITH 1;
    END IF;
END $$;

-- ============================================================================
-- STEP 3: CLEAR OLD SCHEDULING TABLES (if they exist)
-- ============================================================================

-- Clear old babysitting_requests table (if exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'babysitting_requests' AND table_schema = 'public') THEN
        DELETE FROM public.babysitting_requests;
    END IF;
END $$;

-- Clear old request_responses table (if exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'request_responses' AND table_schema = 'public') THEN
        DELETE FROM public.request_responses;
    END IF;
END $$;

-- Clear old scheduled_blocks table (if exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'scheduled_blocks' AND table_schema = 'public') THEN
        DELETE FROM public.scheduled_blocks;
    END IF;
END $$;

-- Clear old block_connections table (if exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'block_connections' AND table_schema = 'public') THEN
        DELETE FROM public.block_connections;
    END IF;
END $$;

-- ============================================================================
-- STEP 4: VERIFICATION QUERY
-- ============================================================================

-- Verify that fundamental data is preserved
SELECT 
    'Profiles' as table_name,
    COUNT(*) as record_count
FROM public.profiles
UNION ALL
SELECT 
    'Groups' as table_name,
    COUNT(*) as record_count
FROM public.groups
UNION ALL
SELECT 
    'Children' as table_name,
    COUNT(*) as record_count
FROM public.children
UNION ALL
SELECT 
    'Group Members' as table_name,
    COUNT(*) as record_count
FROM public.group_members
UNION ALL
SELECT 
    'Chat Messages' as table_name,
    COUNT(*) as record_count
FROM public.chat_messages
UNION ALL
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

-- This query will show "Schedule data cleared successfully!" if everything worked
SELECT 
    CASE 
        WHEN (SELECT COUNT(*) FROM public.care_requests) = 0 
         AND (SELECT COUNT(*) FROM public.scheduled_care) = 0
        THEN '✅ Schedule data cleared successfully!'
        ELSE '❌ Some schedule data may still exist'
    END as status; 