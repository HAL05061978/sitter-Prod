-- Check what tables exist in the database
SELECT '=== ALL TABLES IN PUBLIC SCHEMA ===' as info;
SELECT 
  table_name,
  table_type
FROM information_schema.tables 
WHERE table_schema = 'public'
ORDER BY table_name;

-- Check specifically for care-related tables
SELECT '=== CARE-RELATED TABLES ===' as info;
SELECT 
  table_name
FROM information_schema.tables 
WHERE table_schema = 'public'
  AND table_name LIKE '%care%'
ORDER BY table_name;

-- Check specifically for chat-related tables
SELECT '=== CHAT-RELATED TABLES ===' as info;
SELECT 
  table_name
FROM information_schema.tables 
WHERE table_schema = 'public'
  AND table_name LIKE '%chat%'
ORDER BY table_name;

-- Check for any tables with spaces in names
SELECT '=== TABLES WITH SPACES IN NAMES ===' as info;
SELECT 
  table_name
FROM information_schema.tables 
WHERE table_schema = 'public'
  AND table_name LIKE '% %'
ORDER BY table_name; 