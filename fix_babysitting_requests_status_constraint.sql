-- Fix Babysitting Requests Status Constraint
-- This script updates the status check constraint to include 'closed' as a valid status

-- Step 1: Drop the existing constraint
ALTER TABLE public.babysitting_requests 
DROP CONSTRAINT IF EXISTS babysitting_requests_status_check;

-- Step 2: Add the updated constraint with 'closed' included
ALTER TABLE public.babysitting_requests 
ADD CONSTRAINT babysitting_requests_status_check 
CHECK (status IN ('pending', 'active', 'completed', 'cancelled', 'closed'));

-- Step 3: Verify the constraint was applied correctly
SELECT 
    conname as constraint_name,
    pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint 
WHERE conrelid = 'public.babysitting_requests'::regclass 
AND conname = 'babysitting_requests_status_check';

-- Success message
SELECT 'Babysitting requests status constraint updated successfully! "closed" is now a valid status.' as status; 