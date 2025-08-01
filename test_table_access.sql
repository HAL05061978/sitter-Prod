-- Test if we can access care_requests table
SELECT '=== TESTING CARE_REQUESTS TABLE ===' as info;
SELECT COUNT(*) as care_requests_count FROM care_requests;

-- Test if we can access chat_messages table  
SELECT '=== TESTING CHAT_MESSAGES TABLE ===' as info;
SELECT COUNT(*) as chat_messages_count FROM chat_messages;

-- Check the structure of care_requests table
SELECT '=== CARE_REQUESTS TABLE STRUCTURE ===' as info;
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'care_requests'
ORDER BY ordinal_position;

-- Check the structure of chat_messages table
SELECT '=== CHAT_MESSAGES TABLE STRUCTURE ===' as info;
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'chat_messages'
ORDER BY ordinal_position; 