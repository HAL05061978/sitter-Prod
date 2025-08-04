-- Disable the auto-accept trigger that's causing automatic acceptance
-- This trigger automatically creates scheduled blocks when responses are inserted

-- Check if the trigger exists
SELECT 
    'Trigger Check' as test_name,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.triggers 
            WHERE trigger_name = 'create_initial_scheduled_blocks_trigger'
        ) THEN '⚠️ WARNING: Auto-accept trigger found - this is causing the automatic acceptance'
        ELSE '✅ PASS: No auto-accept trigger found'
    END as status;

-- Disable the trigger if it exists
DROP TRIGGER IF EXISTS create_initial_scheduled_blocks_trigger ON public.request_responses;

-- Also check for any other triggers that might be auto-accepting
SELECT 
    trigger_name,
    event_manipulation,
    action_statement
FROM information_schema.triggers 
WHERE trigger_name LIKE '%invitation%' 
   OR trigger_name LIKE '%response%'
   OR trigger_name LIKE '%accept%'
   OR trigger_name LIKE '%care%';

-- Check if there are any triggers on care_responses table
SELECT 
    trigger_name,
    event_manipulation,
    action_statement
FROM information_schema.triggers 
WHERE event_object_table = 'care_responses';

SELECT 'Auto-accept trigger has been disabled. The invitation flow should now work correctly.' as note; 