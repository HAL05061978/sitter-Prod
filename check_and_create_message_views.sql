-- Check if message_views table already exists
SELECT '=== CHECKING IF MESSAGE_VIEWS TABLE EXISTS ===' as info;
SELECT 
  table_name,
  table_type
FROM information_schema.tables 
WHERE table_schema = 'public'
  AND table_name = 'message_views';

-- Check if the table has the correct structure
SELECT '=== CHECKING MESSAGE_VIEWS TABLE STRUCTURE ===' as info;
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'message_views'
ORDER BY ordinal_position;

-- Check if RLS policies exist
SELECT '=== CHECKING RLS POLICIES ===' as info;
SELECT 
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE tablename = 'message_views'
  AND schemaname = 'public';

-- Test if we can insert a record (to verify permissions)
SELECT '=== TESTING TABLE ACCESS ===' as info;
SELECT COUNT(*) as current_message_views FROM message_views; 