-- Clear all scheduling-related data while preserving profiles, groups, and children
-- This script will remove all scheduling data to allow fresh testing

-- First, drop all scheduling-related functions and triggers
DROP FUNCTION IF EXISTS create_reciprocal_scheduled_blocks() CASCADE;
DROP FUNCTION IF EXISTS invite_specific_parents_to_care(p_group_id UUID, p_inviter_id UUID, p_invitee_ids UUID[], p_time_blocks JSONB) CASCADE;
DROP FUNCTION IF EXISTS accept_group_invitation_with_time_block(p_invitation_id UUID, p_accepting_user_id UUID, p_selected_time_block_index INTEGER, p_selected_child_id UUID) CASCADE;
DROP FUNCTION IF EXISTS get_available_time_blocks_for_invitation(p_invitation_id UUID) CASCADE;
DROP FUNCTION IF EXISTS get_available_group_members_for_invitation(p_group_id UUID, p_inviter_id UUID) CASCADE;
DROP FUNCTION IF EXISTS get_user_children_for_group(p_user_id UUID, p_group_id UUID) CASCADE;

-- Clear all scheduling-related tables
DELETE FROM public.scheduled_blocks;
DELETE FROM public.request_responses;
DELETE FROM public.babysitting_requests;
DELETE FROM public.group_invitations;
DELETE FROM public.invitation_time_blocks;

-- Reset sequences if they exist
DO $$
BEGIN
    -- Reset scheduled_blocks id sequence
    IF EXISTS (SELECT 1 FROM information_schema.sequences WHERE sequence_name = 'scheduled_blocks_id_seq') THEN
        EXECUTE 'ALTER SEQUENCE scheduled_blocks_id_seq RESTART WITH 1';
    END IF;
    
    -- Reset babysitting_requests id sequence
    IF EXISTS (SELECT 1 FROM information_schema.sequences WHERE sequence_name = 'babysitting_requests_id_seq') THEN
        EXECUTE 'ALTER SEQUENCE babysitting_requests_id_seq RESTART WITH 1';
    END IF;
    
    -- Reset request_responses id sequence
    IF EXISTS (SELECT 1 FROM information_schema.sequences WHERE sequence_name = 'request_responses_id_seq') THEN
        EXECUTE 'ALTER SEQUENCE request_responses_id_seq RESTART WITH 1';
    END IF;
    
    -- Reset group_invitations id sequence
    IF EXISTS (SELECT 1 FROM information_schema.sequences WHERE sequence_name = 'group_invitations_id_seq') THEN
        EXECUTE 'ALTER SEQUENCE group_invitations_id_seq RESTART WITH 1';
    END IF;
    
    -- Reset invitation_time_blocks id sequence
    IF EXISTS (SELECT 1 FROM information_schema.sequences WHERE sequence_name = 'invitation_time_blocks_id_seq') THEN
        EXECUTE 'ALTER SEQUENCE invitation_time_blocks_id_seq RESTART WITH 1';
    END IF;
END $$;

-- Verify the cleanup
SELECT 
    'scheduled_blocks' as table_name, COUNT(*) as record_count 
FROM public.scheduled_blocks
UNION ALL
SELECT 
    'request_responses' as table_name, COUNT(*) as record_count 
FROM public.request_responses
UNION ALL
SELECT 
    'babysitting_requests' as table_name, COUNT(*) as record_count 
FROM public.babysitting_requests
UNION ALL
SELECT 
    'group_invitations' as table_name, COUNT(*) as record_count 
FROM public.group_invitations
UNION ALL
SELECT 
    'invitation_time_blocks' as table_name, COUNT(*) as record_count 
FROM public.invitation_time_blocks;

-- Show that profiles, groups, and children are preserved
SELECT 
    'profiles' as table_name, COUNT(*) as record_count 
FROM public.profiles
UNION ALL
SELECT 
    'groups' as table_name, COUNT(*) as record_count 
FROM public.groups
UNION ALL
SELECT 
    'children' as table_name, COUNT(*) as record_count 
FROM public.children
UNION ALL
SELECT 
    'group_members' as table_name, COUNT(*) as record_count 
FROM public.group_members; 