-- Check all care-related tables
SELECT '=== ALL CARE-RELATED TABLES ===' as info;
SELECT 
  table_name,
  table_type
FROM information_schema.tables 
WHERE table_schema = 'public'
  AND (table_name LIKE '%care%' OR table_name LIKE '%Care%' OR table_name LIKE '%Care%')
ORDER BY table_name;

-- Check for any tables with "request" in the name
SELECT '=== TABLES WITH "REQUEST" IN NAME ===' as info;
SELECT 
  table_name,
  table_type
FROM information_schema.tables 
WHERE table_schema = 'public'
  AND table_name LIKE '%request%'
ORDER BY table_name;

-- Check for any tables with "response" in the name
SELECT '=== TABLES WITH "RESPONSE" IN NAME ===' as info;
SELECT 
  table_name,
  table_type
FROM information_schema.tables 
WHERE table_schema = 'public'
  AND table_name LIKE '%response%'
ORDER BY table_name; 