-- Cleanup Script for Scheduling Data
-- This script removes all scheduling-related records while preserving core functionality
-- Run this in your Supabase SQL Editor

-- Start transaction for safety
BEGIN;

-- Clear open block responses (newest table first)
DELETE FROM open_block_responses;

-- Clear open block invitations
DELETE FROM open_block_invitations;

-- Clear open block sessions
DELETE FROM open_block_sessions;

-- Clear care responses
DELETE FROM care_responses;

-- Clear care requests
DELETE FROM care_requests;

-- Clear scheduled care blocks
DELETE FROM scheduled_care;

-- Clear group invitations
DELETE FROM group_invitations;

-- Clear event responses
DELETE FROM event_responses;

-- Clear event notifications
DELETE FROM event_notifications;

-- Clear messages related to scheduling (keep other messages)
DELETE FROM messages 
WHERE subject LIKE '%Open Block%' 
   OR subject LIKE '%Care Request%' 
   OR subject LIKE '%Invitation%' 
   OR subject LIKE '%Response%'
   OR role = 'notification';

-- Reset sequences (if they exist)
-- Note: These might not exist in your schema, but including for completeness
DO $$
BEGIN
    -- Reset sequence for open_block_sessions if it exists
    IF EXISTS (SELECT 1 FROM information_schema.sequences WHERE sequence_name = 'open_block_sessions_id_seq') THEN
        ALTER SEQUENCE open_block_sessions_id_seq RESTART WITH 1;
    END IF;
    
    -- Reset sequence for open_block_invitations if it exists
    IF EXISTS (SELECT 1 FROM information_schema.sequences WHERE sequence_name = 'open_block_invitations_id_seq') THEN
        ALTER SEQUENCE open_block_invitations_id_seq RESTART WITH 1;
    END IF;
    
    -- Reset sequence for open_block_responses if it exists
    IF EXISTS (SELECT 1 FROM information_schema.sequences WHERE sequence_name = 'open_block_responses_id_seq') THEN
        ALTER SEQUENCE open_block_responses_id_seq RESTART WITH 1;
    END IF;
    
    -- Reset sequence for care_requests if it exists
    IF EXISTS (SELECT 1 FROM information_schema.sequences WHERE sequence_name = 'care_requests_id_seq') THEN
        ALTER SEQUENCE care_requests_id_seq RESTART WITH 1;
    END IF;
    
    -- Reset sequence for care_responses if it exists
    IF EXISTS (SELECT 1 FROM information_schema.sequences WHERE sequence_name = 'care_responses_id_seq') THEN
        ALTER SEQUENCE care_responses_id_seq RESTART WITH 1;
    END IF;
    
    -- Reset sequence for scheduled_care if it exists
    IF EXISTS (SELECT 1 FROM information_schema.sequences WHERE sequence_name = 'scheduled_care_id_seq') THEN
        ALTER SEQUENCE scheduled_care_id_seq RESTART WITH 1;
    END IF;
    
    -- Reset sequence for group_invitations if it exists
    IF EXISTS (SELECT 1 FROM information_schema.sequences WHERE sequence_name = 'group_invitations_id_seq') THEN
        ALTER SEQUENCE group_invitations_id_seq RESTART WITH 1;
    END IF;
    
    -- Reset sequence for event_responses if it exists
    IF EXISTS (SELECT 1 FROM information_schema.sequences WHERE sequence_name = 'event_responses_id_seq') THEN
        ALTER SEQUENCE event_responses_id_seq RESTART WITH 1;
    END IF;
    
    -- Reset sequence for event_notifications if it exists
    IF EXISTS (SELECT 1 FROM information_schema.sequences WHERE sequence_name = 'event_notifications_id_seq') THEN
        ALTER SEQUENCE event_notifications_id_seq RESTART WITH 1;
    END IF;
END $$;

-- Commit the transaction
COMMIT;

-- Success message
SELECT 'Scheduling data cleanup completed successfully!' as status; 