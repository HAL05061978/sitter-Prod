-- Clear Scheduling Data (Updated)
-- This script safely clears all scheduling-related records while preserving fundamental app data
-- Run this in your Supabase SQL editor

-- ============================================================================
-- STEP 1: Create backup tables (optional - uncomment if you want backups)
-- ============================================================================

-- Uncomment these lines if you want to create backup tables first
/*
CREATE TABLE IF NOT EXISTS scheduled_blocks_backup AS SELECT * FROM public.scheduled_blocks;
CREATE TABLE IF NOT EXISTS babysitting_requests_backup AS SELECT * FROM public.babysitting_requests;
CREATE TABLE IF NOT EXISTS request_responses_backup AS SELECT * FROM public.request_responses;
CREATE TABLE IF NOT EXISTS group_invitations_backup AS SELECT * FROM public.group_invitations;
CREATE TABLE IF NOT EXISTS invitation_time_blocks_backup AS SELECT * FROM public.invitation_time_blocks;
*/

-- ============================================================================
-- STEP 2: Clear all scheduling-related data
-- ============================================================================

-- Clear scheduled blocks (calendar events)
DELETE FROM public.scheduled_blocks;

-- Clear babysitting requests
DELETE FROM public.babysitting_requests;

-- Clear request responses
DELETE FROM public.request_responses;

-- Clear group invitations
DELETE FROM public.group_invitations;

-- Clear invitation time blocks (if table exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'invitation_time_blocks') THEN
        DELETE FROM public.invitation_time_blocks;
    END IF;
END $$;

-- ============================================================================
-- STEP 3: Reset sequences (if any)
-- ============================================================================

-- Reset any sequences that might be used for IDs
-- Note: Most tables use UUIDs, so sequences might not be needed
DO $$
BEGIN
    -- Reset babysitting_requests sequence if it exists
    IF EXISTS (SELECT 1 FROM information_schema.sequences WHERE sequence_name = 'babysitting_requests_id_seq') THEN
        ALTER SEQUENCE public.babysitting_requests_id_seq RESTART WITH 1;
    END IF;
    
    -- Reset request_responses sequence if it exists
    IF EXISTS (SELECT 1 FROM information_schema.sequences WHERE sequence_name = 'request_responses_id_seq') THEN
        ALTER SEQUENCE public.request_responses_id_seq RESTART WITH 1;
    END IF;
    
    -- Reset group_invitations sequence if it exists
    IF EXISTS (SELECT 1 FROM information_schema.sequences WHERE sequence_name = 'group_invitations_id_seq') THEN
        ALTER SEQUENCE public.group_invitations_id_seq RESTART WITH 1;
    END IF;
    
    -- Reset scheduled_blocks sequence if it exists
    IF EXISTS (SELECT 1 FROM information_schema.sequences WHERE sequence_name = 'scheduled_blocks_id_seq') THEN
        ALTER SEQUENCE public.scheduled_blocks_id_seq RESTART WITH 1;
    END IF;
END $$;

-- ============================================================================
-- STEP 4: Verify data is cleared
-- ============================================================================

-- Check that all scheduling tables are empty
SELECT 
    'Scheduled Blocks' as table_name,
    COUNT(*) as record_count
FROM public.scheduled_blocks
UNION ALL
SELECT 
    'Babysitting Requests' as table_name,
    COUNT(*) as record_count
FROM public.babysitting_requests
UNION ALL
SELECT 
    'Request Responses' as table_name,
    COUNT(*) as record_count
FROM public.request_responses
UNION ALL
SELECT 
    'Group Invitations' as table_name,
    COUNT(*) as record_count
FROM public.group_invitations;

-- ============================================================================
-- STEP 5: Verify fundamental data is preserved
-- ============================================================================

-- Check that fundamental data still exists
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
    'Child Group Members' as table_name,
    COUNT(*) as record_count
FROM public.child_group_members;

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================

SELECT 'Scheduling data cleared successfully! 

✅ PRESERVED:
- Profiles
- Groups  
- Children
- Group Members
- Child Group Members
- All RLS policies
- All functions and triggers

🗑️ CLEARED:
- Scheduled blocks (calendar events)
- Babysitting requests
- Request responses
- Group invitations
- Invitation time blocks

You can now test the scheduling system from scratch!' as status; 