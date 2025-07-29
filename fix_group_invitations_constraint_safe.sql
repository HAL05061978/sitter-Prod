-- Fix the unique constraint issue in group_invitations table (safe approach)
-- Run this in Supabase SQL editor

-- First, let's see what constraints exist and their dependencies
SELECT 
  tc.constraint_name,
  tc.constraint_type,
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
LEFT JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
WHERE tc.table_name = 'group_invitations'
ORDER BY tc.constraint_type, tc.constraint_name;

-- Check if there's a specific unique constraint on (request_id, invitee_id)
SELECT 
  conname,
  contype,
  pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint 
WHERE conrelid = 'group_invitations'::regclass
  AND contype = 'u'  -- unique constraints only
  AND pg_get_constraintdef(oid) LIKE '%request_id%'
  AND pg_get_constraintdef(oid) LIKE '%invitee_id%';

-- Only drop the specific problematic constraint, not the primary key
DO $$
DECLARE
  constraint_name TEXT;
BEGIN
  -- Find the specific constraint that includes request_id and invitee_id
  SELECT conname INTO constraint_name
  FROM pg_constraint 
  WHERE conrelid = 'group_invitations'::regclass
    AND contype = 'u'  -- unique constraints only
    AND pg_get_constraintdef(oid) LIKE '%request_id%'
    AND pg_get_constraintdef(oid) LIKE '%invitee_id%'
    AND conname != 'group_invitations_pkey';  -- Don't touch the primary key
    
  IF constraint_name IS NOT NULL THEN
    EXECUTE 'ALTER TABLE group_invitations DROP CONSTRAINT ' || constraint_name;
    RAISE NOTICE 'Dropped constraint: %', constraint_name;
  ELSE
    RAISE NOTICE 'No problematic unique constraint found on (request_id, invitee_id)';
  END IF;
END $$;

-- Now add a more flexible unique constraint
ALTER TABLE group_invitations 
ADD CONSTRAINT group_invitations_unique_invitation 
UNIQUE (request_id, invitee_id, invitation_date, invitation_start_time, invitation_end_time);

-- Verify the final constraints
SELECT 
  conname,
  contype,
  pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint 
WHERE conrelid = 'group_invitations'::regclass
ORDER BY contype, conname;