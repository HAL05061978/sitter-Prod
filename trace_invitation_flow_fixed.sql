-- Trace the invitation flow to identify where auto-approval occurs
-- This script will help us understand exactly what's happening

-- Step 1: Check what functions exist that might be auto-accepting
SELECT '=== FUNCTIONS THAT MIGHT AUTO-ACCEPT ===' as info;
SELECT 
    routine_name,
    routine_type,
    data_type as return_type
FROM information_schema.routines 
WHERE routine_name LIKE '%accept%'
   OR routine_name LIKE '%response%'
   OR routine_name LIKE '%invitation%'
   OR routine_name LIKE '%care%'
   OR routine_name LIKE '%exchange%'
   OR routine_name LIKE '%submit%'
ORDER BY routine_name;

-- Step 2: Check what triggers exist that might be auto-accepting
SELECT '=== TRIGGERS THAT MIGHT AUTO-ACCEPT ===' as info;
SELECT 
    trigger_name,
    event_object_table,
    event_manipulation,
    action_statement
FROM information_schema.triggers 
WHERE event_object_table IN ('care_responses', 'care_requests')
   OR trigger_name LIKE '%accept%'
   OR trigger_name LIKE '%response%'
   OR trigger_name LIKE '%invitation%'
   OR trigger_name LIKE '%care%'
ORDER BY trigger_name;

-- Step 3: Check the current state of tables
SELECT '=== CURRENT TABLE STATE ===' as info;
SELECT 'Care Requests' as table_name, COUNT(*) as count FROM care_requests;
SELECT 'Care Responses' as table_name, COUNT(*) as count FROM care_responses;

-- Step 4: Show recent activity
SELECT '=== RECENT CARE RESPONSES ===' as info;
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
LIMIT 10;

-- Step 5: Check if there are any RLS policies that might be affecting this
SELECT '=== RLS POLICIES ===' as info;
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
WHERE tablename IN ('care_responses', 'care_requests')
ORDER BY tablename, policyname;

-- Step 6: Check for any database functions that might be called automatically
SELECT '=== POTENTIAL AUTO-ACCEPT FUNCTIONS ===' as info;
SELECT 
    p.proname as function_name,
    pg_get_functiondef(p.oid) as function_definition
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
AND (
    p.proname LIKE '%accept%'
    OR p.proname LIKE '%response%'
    OR p.proname LIKE '%invitation%'
    OR p.proname LIKE '%care%'
    OR p.proname LIKE '%exchange%'
    OR p.proname LIKE '%submit%'
)
ORDER BY p.proname;

SELECT 'Ready to trace invitation flow. Run this after sending an invitation to see what happens.' as note; 