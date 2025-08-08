-- Drop any existing open block triggers that might be creating extra blocks
-- This will prevent any old triggers from interfering with our frontend logic

-- Drop trigger if it exists
DROP TRIGGER IF EXISTS handle_open_block_acceptance_trigger ON open_block_responses;

-- Drop the function if it exists
DROP FUNCTION IF EXISTS handle_open_block_acceptance();

-- Check if there are any other triggers on open_block_responses
SELECT 
    trigger_name,
    event_manipulation,
    event_object_table,
    action_statement
FROM information_schema.triggers 
WHERE event_object_table = 'open_block_responses';

-- Check if there are any triggers on scheduled_care that might be creating blocks
SELECT 
    trigger_name,
    event_manipulation,
    event_object_table,
    action_statement
FROM information_schema.triggers 
WHERE event_object_table = 'scheduled_care';

-- Success message
SELECT '=== TRIGGERS DROPPED ===' as status;
SELECT 'Any existing open block triggers have been removed.' as info;
SELECT 'The frontend will now handle all open block logic directly.' as info;
