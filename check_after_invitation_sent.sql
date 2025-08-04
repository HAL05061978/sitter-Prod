-- Check what happened after the invitation was sent
-- This will show us what records were created and what might be causing auto-acceptance

-- Check what care requests were created
SELECT '=== CARE REQUESTS AFTER INVITATION ===' as info;
SELECT 
    id,
    requester_id,
    status,
    created_at,
    LEFT(notes, 100) as notes_preview
FROM care_requests 
ORDER BY created_at DESC 
LIMIT 5;

-- Check what care responses were created
SELECT '=== CARE RESPONSES AFTER INVITATION ===' as info;
SELECT 
    id,
    request_id,
    responder_id,
    response_type,
    status,
    LEFT(response_notes, 100) as notes_preview,
    created_at
FROM care_responses 
ORDER BY created_at DESC 
LIMIT 5;

-- Check if any functions were called automatically
SELECT '=== RECENT FUNCTION CALLS ===' as info;
SELECT 
    'No direct way to see function calls, but we can check what functions exist' as note;

-- Check what triggers might have fired
SELECT '=== TRIGGERS ON CARE_RESPONSES ===' as info;
SELECT 
    trigger_name,
    event_manipulation,
    action_statement
FROM information_schema.triggers 
WHERE event_object_table = 'care_responses'
ORDER BY trigger_name;

-- Check what triggers might have fired
SELECT '=== TRIGGERS ON CARE_REQUESTS ===' as info;
SELECT 
    trigger_name,
    event_manipulation,
    action_statement
FROM information_schema.triggers 
WHERE event_object_table = 'care_requests'
ORDER BY trigger_name;

-- Check if there are any functions that might auto-accept
SELECT '=== FUNCTIONS THAT MIGHT AUTO-ACCEPT ===' as info;
SELECT 
    routine_name,
    routine_type
FROM information_schema.routines 
WHERE routine_name LIKE '%accept%'
   OR routine_name LIKE '%response%'
   OR routine_name LIKE '%invitation%'
   OR routine_name LIKE '%care%'
   OR routine_name LIKE '%exchange%'
   OR routine_name LIKE '%submit%'
ORDER BY routine_name;

SELECT 'Now accept the invitation as Parent B and run this script again to see what changes.' as note; 