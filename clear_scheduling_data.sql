-- Clear Scheduling Data Safely
-- This script clears all scheduling-related records while preserving fundamental app data
-- Run this in your Supabase SQL editor

-- ============================================================================
-- STEP 1: Clear all scheduling-related data (in correct order due to foreign keys)
-- ============================================================================

-- Clear group invitations first (if table exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'group_invitations') THEN
        DELETE FROM public.group_invitations;
        RAISE NOTICE 'Cleared group_invitations table';
    ELSE
        RAISE NOTICE 'group_invitations table does not exist, skipping';
    END IF;
END $$;

-- Clear invitation time blocks (if table exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'invitation_time_blocks') THEN
        DELETE FROM public.invitation_time_blocks;
        RAISE NOTICE 'Cleared invitation_time_blocks table';
    ELSE
        RAISE NOTICE 'invitation_time_blocks table does not exist, skipping';
    END IF;
END $$;

-- Clear block connections
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'block_connections') THEN
        DELETE FROM public.block_connections;
        RAISE NOTICE 'Cleared block_connections table';
    ELSE
        RAISE NOTICE 'block_connections table does not exist, skipping';
    END IF;
END $$;

-- Clear scheduled blocks
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'scheduled_blocks') THEN
        DELETE FROM public.scheduled_blocks;
        RAISE NOTICE 'Cleared scheduled_blocks table';
    ELSE
        RAISE NOTICE 'scheduled_blocks table does not exist, skipping';
    END IF;
END $$;

-- Clear request responses
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'request_responses') THEN
        DELETE FROM public.request_responses;
        RAISE NOTICE 'Cleared request_responses table';
    ELSE
        RAISE NOTICE 'request_responses table does not exist, skipping';
    END IF;
END $$;

-- Clear babysitting requests
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'babysitting_requests') THEN
        DELETE FROM public.babysitting_requests;
        RAISE NOTICE 'Cleared babysitting_requests table';
    ELSE
        RAISE NOTICE 'babysitting_requests table does not exist, skipping';
    END IF;
END $$;

-- ============================================================================
-- STEP 2: Verify fundamental data is preserved
-- ============================================================================

-- Check that fundamental tables still have data
SELECT 
    'Data Preservation Check' as check_type,
    CASE 
        WHEN EXISTS (SELECT 1 FROM public.profiles LIMIT 1) THEN '✅ PASS: Profiles preserved'
        ELSE '❌ FAIL: No profiles found'
    END as profiles_status;

SELECT 
    'Data Preservation Check' as check_type,
    CASE 
        WHEN EXISTS (SELECT 1 FROM public.children LIMIT 1) THEN '✅ PASS: Children preserved'
        ELSE '❌ FAIL: No children found'
    END as children_status;

SELECT 
    'Data Preservation Check' as check_type,
    CASE 
        WHEN EXISTS (SELECT 1 FROM public.groups LIMIT 1) THEN '✅ PASS: Groups preserved'
        ELSE '❌ FAIL: No groups found'
    END as groups_status;

SELECT 
    'Data Preservation Check' as check_type,
    CASE 
        WHEN EXISTS (SELECT 1 FROM public.group_members LIMIT 1) THEN '✅ PASS: Group members preserved'
        ELSE '❌ FAIL: No group members found'
    END as group_members_status;

SELECT 
    'Data Preservation Check' as check_type,
    CASE 
        WHEN EXISTS (SELECT 1 FROM public.child_group_members LIMIT 1) THEN '✅ PASS: Child group members preserved'
        ELSE '❌ FAIL: No child group members found'
    END as child_group_members_status;

-- ============================================================================
-- STEP 3: Verify scheduling data is cleared
-- ============================================================================

-- Check that scheduling tables are empty
SELECT 
    'Scheduling Data Clear Check' as check_type,
    CASE 
        WHEN NOT EXISTS (SELECT 1 FROM public.babysitting_requests) THEN '✅ PASS: Babysitting requests cleared'
        ELSE '❌ FAIL: Babysitting requests still exist'
    END as babysitting_requests_status;

SELECT 
    'Scheduling Data Clear Check' as check_type,
    CASE 
        WHEN NOT EXISTS (SELECT 1 FROM public.request_responses) THEN '✅ PASS: Request responses cleared'
        ELSE '❌ FAIL: Request responses still exist'
    END as request_responses_status;

SELECT 
    'Scheduling Data Clear Check' as check_type,
    CASE 
        WHEN NOT EXISTS (SELECT 1 FROM public.scheduled_blocks) THEN '✅ PASS: Scheduled blocks cleared'
        ELSE '❌ FAIL: Scheduled blocks still exist'
    END as scheduled_blocks_status;

-- ============================================================================
-- STEP 4: Summary
-- ============================================================================

SELECT 'Scheduling data cleared successfully! 

✅ PRESERVED:
- Profiles (users)
- Children 
- Groups
- Group members
- Child group members

🗑️ CLEARED:
- Babysitting requests
- Request responses  
- Scheduled blocks
- Block connections
- Group invitations
- Invitation time blocks

The app is now ready for fresh scheduling data.' as summary; 