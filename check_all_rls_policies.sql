-- Check all RLS policies that might affect scheduling
-- Run this in Supabase SQL editor

-- Check RLS status for all relevant tables
SELECT 
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables 
WHERE tablename IN ('scheduled_blocks', 'request_responses', 'babysitting_requests', 'children', 'group_members', 'profiles')
ORDER BY tablename;

-- Check existing policies for these tables
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE tablename IN ('scheduled_blocks', 'request_responses', 'babysitting_requests', 'children', 'group_members', 'profiles')
ORDER BY tablename, policyname;

-- If needed, disable RLS on tables that the function needs to update
-- ALTER TABLE request_responses DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE babysitting_requests DISABLE ROW LEVEL SECURITY;