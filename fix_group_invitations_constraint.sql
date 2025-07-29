-- Fix the unique constraint issue in group_invitations table
-- Run this in Supabase SQL editor

-- Check the current constraints on group_invitations table
SELECT 
  conname,
  contype,
  pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint 
WHERE conrelid = 'group_invitations'::regclass;

-- Check the table structure
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'group_invitations'
ORDER BY ordinal_position;

-- Drop the problematic unique constraint if it exists
DO $$
BEGIN
  -- Try to drop the constraint if it exists
  EXECUTE 'ALTER TABLE group_invitations DROP CONSTRAINT IF EXISTS group_invitations_request_id_invitee_id_key';
  
  -- Also try alternative constraint names
  EXECUTE 'ALTER TABLE group_invitations DROP CONSTRAINT IF EXISTS group_invitations_pkey';
  EXECUTE 'ALTER TABLE group_invitations DROP CONSTRAINT IF EXISTS group_invitations_request_invitee_key';
  
  RAISE NOTICE 'Attempted to drop unique constraints on group_invitations';
END $$;

-- Create a more flexible unique constraint that allows multiple invitations per request per invitee
-- but prevents exact duplicates (same date, time, etc.)
ALTER TABLE group_invitations 
ADD CONSTRAINT group_invitations_unique_invitation 
UNIQUE (request_id, invitee_id, invitation_date, invitation_start_time, invitation_end_time);

-- Verify the changes
SELECT 
  conname,
  contype,
  pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint 
WHERE conrelid = 'group_invitations'::regclass;