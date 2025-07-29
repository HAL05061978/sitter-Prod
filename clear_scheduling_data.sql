-- Clear Scheduling Data Script
-- This script safely removes all scheduling-related records while preserving core application data
-- Run this in your Supabase SQL Editor

-- Step 1: Disable triggers temporarily to avoid conflicts during cleanup
DROP TRIGGER IF EXISTS create_initial_scheduled_blocks_trigger ON public.request_responses;
DROP TRIGGER IF EXISTS close_request_trigger ON public.request_responses;
DROP TRIGGER IF EXISTS create_additional_care_trigger ON public.request_responses;

-- Step 2: Clear all scheduling-related data in the correct order (respecting foreign key constraints)

-- Clear block connections first (they reference scheduled_blocks)
DELETE FROM public.block_connections;

-- Clear scheduled blocks
DELETE FROM public.scheduled_blocks;

-- Clear request responses
DELETE FROM public.request_responses;

-- Clear babysitting requests
DELETE FROM public.babysitting_requests;

-- Clear group invitations (if the table exists)
DELETE FROM public.group_invitations;

-- Step 3: Clear any additional care related data (if tables exist)
-- Note: These tables might not exist depending on your current schema
DROP TABLE IF EXISTS public.additional_care_requests CASCADE;
DROP TABLE IF EXISTS public.multi_child_care_opportunities CASCADE;

-- Step 4: Drop scheduling-related functions and views
DROP FUNCTION IF EXISTS create_initial_scheduled_blocks() CASCADE;
DROP FUNCTION IF EXISTS invite_group_members_to_care(UUID, UUID, DATE, TIME, TIME) CASCADE;
DROP FUNCTION IF EXISTS accept_group_invitation(UUID, UUID) CASCADE;
DROP FUNCTION IF EXISTS close_request_if_not_open_to_others() CASCADE;
DROP FUNCTION IF EXISTS create_additional_care_request() CASCADE;
DROP FUNCTION IF EXISTS check_time_conflicts(UUID, DATE, TIME, TIME, UUID) CASCADE;
DROP FUNCTION IF EXISTS update_scheduled_block(UUID, DATE, TIME, TIME, INTEGER, BOOLEAN, TEXT) CASCADE;
DROP FUNCTION IF EXISTS get_open_care_blocks_for_joining(UUID[]) CASCADE;
DROP FUNCTION IF EXISTS get_available_children_for_joining_care(UUID) CASCADE;
DROP FUNCTION IF EXISTS join_existing_care_block(UUID, UUID, TIMESTAMP WITH TIME ZONE, TIMESTAMP WITH TIME ZONE, UUID) CASCADE;
DROP FUNCTION IF EXISTS agree_to_additional_reciprocal(UUID) CASCADE;

-- Step 5: Drop scheduling-related views
DROP VIEW IF EXISTS public.multi_child_care_opportunities CASCADE;

-- Step 6: Reset sequences (if any exist)
-- Note: Most tables use gen_random_uuid() so sequences might not be needed
-- But we'll reset any that might exist
DO $$
DECLARE
    seq_name TEXT;
BEGIN
    -- Reset any sequences that might exist for scheduling tables
    FOR seq_name IN 
        SELECT sequence_name 
        FROM information_schema.sequences 
        WHERE sequence_schema = 'public' 
        AND sequence_name LIKE '%scheduled%' 
        OR sequence_name LIKE '%request%'
        OR sequence_name LIKE '%block%'
    LOOP
        EXECUTE 'ALTER SEQUENCE ' || seq_name || ' RESTART WITH 1';
    END LOOP;
END $$;

-- Step 7: Verify cleanup by checking record counts
SELECT 
    'babysitting_requests' as table_name,
    COUNT(*) as record_count
FROM public.babysitting_requests
UNION ALL
SELECT 
    'request_responses' as table_name,
    COUNT(*) as record_count
FROM public.request_responses
UNION ALL
SELECT 
    'scheduled_blocks' as table_name,
    COUNT(*) as record_count
FROM public.scheduled_blocks
UNION ALL
SELECT 
    'block_connections' as table_name,
    COUNT(*) as record_count
FROM public.block_connections
UNION ALL
SELECT 
    'group_invitations' as table_name,
    COUNT(*) as record_count
FROM public.group_invitations;

-- Step 8: Success message
SELECT 'All scheduling data cleared successfully! Core application data (profiles, children, groups, etc.) preserved.' as status; 