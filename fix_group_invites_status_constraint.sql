-- Fix the status constraint to allow 'rejected' status
-- Drop the existing constraint
ALTER TABLE public.group_invites 
DROP CONSTRAINT IF EXISTS group_invites_status_check;

-- Add the new constraint that allows 'rejected'
ALTER TABLE public.group_invites 
ADD CONSTRAINT group_invites_status_check 
CHECK (status = ANY (ARRAY['pending'::text, 'accepted'::text, 'rejected'::text]));

-- Verify the constraint was updated
SELECT 
  conname as constraint_name,
  pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint 
WHERE conrelid = 'public.group_invites'::regclass 
  AND conname = 'group_invites_status_check';

SELECT '✅ Status constraint updated to allow: pending, accepted, rejected' as status; 