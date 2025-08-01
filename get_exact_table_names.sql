-- Get the exact table names with spaces
SELECT '=== EXACT TABLE NAMES WITH SPACES ===' as info;
SELECT 
  table_name,
  table_type
FROM information_schema.tables 
WHERE table_schema = 'public'
  AND table_name LIKE '% %'
ORDER BY table_name;

-- Also check for any tables that might be the care requests table
SELECT '=== ALL TABLES THAT MIGHT BE CARE REQUESTS ===' as info;
SELECT 
  table_name,
  table_type
FROM information_schema.tables 
WHERE table_schema = 'public'
  AND (
    table_name LIKE '%care%' OR 
    table_name LIKE '%request%' OR 
    table_name LIKE '%scheduled%' OR
    table_name LIKE '%event%'
  )
ORDER BY table_name; 