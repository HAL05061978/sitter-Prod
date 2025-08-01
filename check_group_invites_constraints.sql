-- Check the constraints on group_invites table
SELECT 
  conname as constraint_name,
  pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint 
WHERE conrelid = 'public.group_invites'::regclass;

-- Check the current valid status values
SELECT DISTINCT status FROM public.group_invites ORDER BY status;

-- Check the table definition
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'group_invites' 
  AND column_name = 'status'; 