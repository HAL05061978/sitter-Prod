-- Simple Trigger Test
-- This script creates a test response to see if the trigger fires

-- First, let's check the current state
SELECT '=== BEFORE TEST ===' as info;

-- Check current invitation status
SELECT 
    id,
    status,
    accepted_parent_id,
    updated_at
FROM open_block_invitations 
WHERE id = '64cdb042-c92e-4d54-a3f9-582992d1ef89';

-- Check if trigger exists
SELECT 
    trigger_name,
    event_manipulation,
    event_object_table,
    action_timing
FROM information_schema.triggers 
WHERE trigger_name = 'handle_open_block_acceptance_trigger';

-- Now let's create a test response to trigger the function
SELECT '=== CREATING TEST RESPONSE ===' as info;

-- Insert a test response (this should trigger the function)
INSERT INTO open_block_responses (
    invitation_id,
    parent_id,
    response,
    child_id,
    notes
) VALUES (
    '64cdb042-c92e-4d54-a3f9-582992d1ef89',
    '8c7b93f6-582d-4208-9cdd-65a940a1d18d',
    'accept',
    (SELECT id FROM children WHERE parent_id = '8c7b93f6-582d-4208-9cdd-65a940a1d18d' LIMIT 1),
    'Test trigger response'
);

-- Check the results after the test
SELECT '=== AFTER TEST ===' as info;

-- Check if invitation status was updated
SELECT 
    id,
    status,
    accepted_parent_id,
    updated_at
FROM open_block_invitations 
WHERE id = '64cdb042-c92e-4d54-a3f9-582992d1ef89';

-- Check if any care children were created
SELECT 
    COUNT(*) as care_children_count
FROM scheduled_care_children 
WHERE notes LIKE '%Open block acceptance%';

-- Check if any care blocks were created
SELECT 
    COUNT(*) as care_blocks_count
FROM scheduled_care 
WHERE notes LIKE '%Open block acceptance%';

-- Check the test response that was created
SELECT 
    id,
    invitation_id,
    parent_id,
    response,
    child_id,
    created_at
FROM open_block_responses 
WHERE notes = 'Test trigger response'
ORDER BY created_at DESC 
LIMIT 1;

-- Success message
SELECT 'Simple trigger test completed. Check the results above.' as status;
