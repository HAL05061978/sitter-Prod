-- Check for tables with spaces in names and show their exact names
SELECT '=== TABLES WITH SPACES IN NAMES ===' as info;
SELECT 
  table_name,
  table_type
FROM information_schema.tables 
WHERE table_schema = 'public'
  AND table_name LIKE '% %'
ORDER BY table_name;

-- Also check for care and chat related tables specifically
SELECT '=== ALL CARE-RELATED TABLES (including spaces) ===' as info;
SELECT 
  table_name,
  table_type
FROM information_schema.tables 
WHERE table_schema = 'public'
  AND (table_name LIKE '%care%' OR table_name LIKE '%Care%')
ORDER BY table_name;

SELECT '=== ALL CHAT-RELATED TABLES (including spaces) ===' as info;
SELECT 
  table_name,
  table_type
FROM information_schema.tables 
WHERE table_schema = 'public'
  AND (table_name LIKE '%chat%' OR table_name LIKE '%Chat%')
ORDER BY table_name; 