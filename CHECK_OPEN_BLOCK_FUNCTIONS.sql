-- Check for any functions that might be creating extra blocks
-- This will help identify what's creating the "Unknown Parent" block

-- Check for any functions that reference open_block
SELECT 
    routine_name,
    routine_type,
    routine_definition
FROM information_schema.routines 
WHERE routine_definition LIKE '%open_block%'
   OR routine_definition LIKE '%scheduled_care%'
   OR routine_definition LIKE '%care_requests%';

-- Check for any functions that might be creating scheduled_care entries
SELECT 
    routine_name,
    routine_type,
    routine_definition
FROM information_schema.routines 
WHERE routine_definition LIKE '%INSERT INTO scheduled_care%'
   OR routine_definition LIKE '%scheduled_care%INSERT%';

-- Check for any functions that might be creating blocks with null parent_id
SELECT 
    routine_name,
    routine_type,
    routine_definition
FROM information_schema.routines 
WHERE routine_definition LIKE '%parent_id%'
   AND routine_definition LIKE '%scheduled_care%';

-- Check if there are any RPC functions that might be called
SELECT 
    routine_name,
    routine_type
FROM information_schema.routines 
WHERE routine_schema = 'public'
   AND routine_type = 'FUNCTION'
   AND (routine_name LIKE '%open_block%' 
        OR routine_name LIKE '%care%' 
        OR routine_name LIKE '%block%');
