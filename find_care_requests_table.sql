-- Check for any tables that might be care requests
SELECT '=== ALL TABLES WITH "CARE" IN NAME ===' as info;
SELECT 
  table_name,
  table_type
FROM information_schema.tables 
WHERE table_schema = 'public'
  AND table_name LIKE '%care%'
ORDER BY table_name;

-- Check for any tables with "scheduled" in the name (might be care requests)
SELECT '=== TABLES WITH "SCHEDULED" IN NAME ===' as info;
SELECT 
  table_name,
  table_type
FROM information_schema.tables 
WHERE table_schema = 'public'
  AND table_name LIKE '%scheduled%'
ORDER BY table_name;

-- Check for any tables with "event" in the name
SELECT '=== TABLES WITH "EVENT" IN NAME ===' as info;
SELECT 
  table_name,
  table_type
FROM information_schema.tables 
WHERE table_schema = 'public'
  AND table_name LIKE '%event%'
ORDER BY table_name;

-- Check for any tables with spaces in names that might be care-related
SELECT '=== TABLES WITH SPACES THAT MIGHT BE CARE-RELATED ===' as info;
SELECT 
  table_name,
  table_type
FROM information_schema.tables 
WHERE table_schema = 'public'
  AND table_name LIKE '% %'
  AND (table_name LIKE '%care%' OR table_name LIKE '%request%' OR table_name LIKE '%scheduled%')
ORDER BY table_name; 