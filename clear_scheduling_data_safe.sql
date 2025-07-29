-- Clear Scheduling Data Safely
-- This script removes all scheduling-related data while preserving fundamental app data
-- Run this in your Supabase SQL editor

-- ============================================================================
-- STEP 1: BACKUP CURRENT DATA (Optional but recommended)
-- ============================================================================

-- Create backup tables with current data (optional)
CREATE TABLE IF NOT EXISTS backup_scheduled_blocks AS 
SELECT * FROM public.scheduled_blocks;

CREATE TABLE IF NOT EXISTS backup_babysitting_requests AS 
SELECT * FROM public.babysitting_requests;

CREATE TABLE IF NOT EXISTS backup_request_responses AS 
SELECT * FROM public.request_responses;

CREATE TABLE IF NOT EXISTS backup_group_invitations AS 
SELECT * FROM public.group_invitations;

-- ============================================================================
-- STEP 2: CLEAR SCHEDULING DATA IN CORRECT ORDER
-- ============================================================================

-- Clear scheduled blocks first (they reference requests)
DELETE FROM public.scheduled_blocks;

-- Clear request responses (they reference requests)
DELETE FROM public.request_responses;

-- Clear babysitting requests
DELETE FROM public.babysitting_requests;

-- Clear group invitations
DELETE FROM public.group_invitations;

-- ============================================================================
-- STEP 3: RESET SEQUENCES (if any)
-- ============================================================================

-- Reset any auto-increment sequences (if using serial IDs)
-- Note: This is only needed if you're using serial IDs instead of UUIDs
-- Most Supabase tables use UUIDs, so this section may not be needed

-- ============================================================================
-- STEP 4: VERIFY FUNDAMENTAL DATA IS PRESERVED
-- ============================================================================

-- Check that fundamental data is still intact
SELECT 
    'Profiles Check' as check_type,
    COUNT(*) as count,
    CASE 
        WHEN COUNT(*) > 0 THEN '✅ PASS: Profiles preserved'
        ELSE '❌ FAIL: No profiles found'
    END as status
FROM public.profiles;

SELECT 
    'Children Check' as check_type,
    COUNT(*) as count,
    CASE 
        WHEN COUNT(*) > 0 THEN '✅ PASS: Children preserved'
        ELSE '❌ FAIL: No children found'
    END as status
FROM public.children;

SELECT 
    'Groups Check' as check_type,
    COUNT(*) as count,
    CASE 
        WHEN COUNT(*) > 0 THEN '✅ PASS: Groups preserved'
        ELSE '❌ FAIL: No groups found'
    END as status
FROM public.groups;

SELECT 
    'Group Members Check' as check_type,
    COUNT(*) as count,
    CASE 
        WHEN COUNT(*) > 0 THEN '✅ PASS: Group members preserved'
        ELSE '❌ FAIL: No group members found'
    END as status
FROM public.group_members;

SELECT 
    'Child Group Members Check' as check_type,
    COUNT(*) as count,
    CASE 
        WHEN COUNT(*) > 0 THEN '✅ PASS: Child group members preserved'
        ELSE '❌ FAIL: No child group members found'
    END as status
FROM public.child_group_members;

-- ============================================================================
-- STEP 5: VERIFY SCHEDULING DATA IS CLEARED
-- ============================================================================

-- Verify that scheduling data is cleared
SELECT 
    'Scheduled Blocks Check' as check_type,
    COUNT(*) as count,
    CASE 
        WHEN COUNT(*) = 0 THEN '✅ PASS: Scheduled blocks cleared'
        ELSE '❌ FAIL: Scheduled blocks still exist'
    END as status
FROM public.scheduled_blocks;

SELECT 
    'Babysitting Requests Check' as check_type,
    COUNT(*) as count,
    CASE 
        WHEN COUNT(*) = 0 THEN '✅ PASS: Babysitting requests cleared'
        ELSE '❌ FAIL: Babysitting requests still exist'
    END as status
FROM public.babysitting_requests;

SELECT 
    'Request Responses Check' as check_type,
    COUNT(*) as count,
    CASE 
        WHEN COUNT(*) = 0 THEN '✅ PASS: Request responses cleared'
        ELSE '❌ FAIL: Request responses still exist'
    END as status
FROM public.request_responses;

SELECT 
    'Group Invitations Check' as check_type,
    COUNT(*) as count,
    CASE 
        WHEN COUNT(*) = 0 THEN '✅ PASS: Group invitations cleared'
        ELSE '❌ FAIL: Group invitations still exist'
    END as status
FROM public.group_invitations;

-- ============================================================================
-- STEP 6: SHOW BACKUP TABLES (if created)
-- ============================================================================

-- Show what was backed up (if backup tables were created)
SELECT 
    'Backup Summary' as summary,
    (SELECT COUNT(*) FROM backup_scheduled_blocks) as scheduled_blocks_backed_up,
    (SELECT COUNT(*) FROM backup_babysitting_requests) as requests_backed_up,
    (SELECT COUNT(*) FROM backup_request_responses) as responses_backed_up,
    (SELECT COUNT(*) FROM backup_group_invitations) as invitations_backed_up;

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================

SELECT 'Scheduling data cleared successfully! All fundamental app data (profiles, children, groups) has been preserved.' as status;

-- ============================================================================
-- OPTIONAL: DROP BACKUP TABLES (uncomment if you want to remove backups)
-- ============================================================================

-- Uncomment these lines if you want to remove the backup tables
-- DROP TABLE IF EXISTS backup_scheduled_blocks;
-- DROP TABLE IF EXISTS backup_babysitting_requests;
-- DROP TABLE IF EXISTS backup_request_responses;
-- DROP TABLE IF EXISTS backup_group_invitations; 