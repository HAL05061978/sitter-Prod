-- Test Trigger with New Invitation
-- This script will find an available invitation and test the trigger

-- First, let's find an invitation that hasn't been responded to by our test parent
SELECT '=== FINDING AVAILABLE INVITATION ===' as info;

WITH available_invitations AS (
    SELECT 
        obi.id as invitation_id,
        obi.invited_parent_id,
        obi.status,
        obi.created_at
    FROM open_block_invitations obi
    LEFT JOIN open_block_responses obr ON obi.id = obr.invitation_id 
        AND obr.parent_id = '8c7b93f6-582d-4208-9cdd-65a940a1d18d'
    WHERE obi.status = 'active' 
        AND obr.id IS NULL
    ORDER BY obi.created_at DESC
    LIMIT 1
)
SELECT * FROM available_invitations;

-- Now let's test the trigger with the first available invitation
SELECT '=== TESTING TRIGGER ===' as info;

-- Get the first available invitation
DO $$
DECLARE
    test_invitation_id UUID;
    test_child_id UUID;
BEGIN
    -- Find an available invitation
    SELECT obi.id INTO test_invitation_id
    FROM open_block_invitations obi
    LEFT JOIN open_block_responses obr ON obi.id = obr.invitation_id 
        AND obr.parent_id = '8c7b93f6-582d-4208-9cdd-65a940a1d18d'
    WHERE obi.status = 'active' 
        AND obr.id IS NULL
    ORDER BY obi.created_at DESC
    LIMIT 1;
    
    -- Get a child for the test parent
    SELECT id INTO test_child_id
    FROM children 
    WHERE parent_id = '8c7b93f6-582d-4208-9cdd-65a940a1d18d' 
    LIMIT 1;
    
    IF test_invitation_id IS NULL THEN
        RAISE NOTICE 'No available invitations found for testing';
        RETURN;
    END IF;
    
    IF test_child_id IS NULL THEN
        RAISE NOTICE 'No children found for test parent';
        RETURN;
    END IF;
    
    RAISE NOTICE 'Testing with invitation: %', test_invitation_id;
    RAISE NOTICE 'Using child: %', test_child_id;
    
    -- Check invitation status before test
    RAISE NOTICE 'Invitation status before test: %', 
        (SELECT status FROM open_block_invitations WHERE id = test_invitation_id);
    
    -- Insert a test response (this should trigger the function)
    INSERT INTO open_block_responses (
        invitation_id,
        parent_id,
        response,
        child_id,
        notes
    ) VALUES (
        test_invitation_id,
        '8c7b93f6-582d-4208-9cdd-65a940a1d18d',
        'accept',
        test_child_id,
        'Test trigger response - new invitation'
    );
    
    RAISE NOTICE 'Test response created successfully';
    
    -- Check invitation status after test
    RAISE NOTICE 'Invitation status after test: %', 
        (SELECT status FROM open_block_invitations WHERE id = test_invitation_id);
    
    -- Check if accepted_parent_id was set
    RAISE NOTICE 'Accepted parent ID after test: %', 
        (SELECT accepted_parent_id FROM open_block_invitations WHERE id = test_invitation_id);
    
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Error in trigger test: %', SQLERRM;
        RAISE NOTICE 'SQLSTATE: %', SQLSTATE;
END $$;

-- Check the results
SELECT '=== TEST RESULTS ===' as info;

-- Check if any invitations were updated
SELECT 
    id,
    status,
    accepted_parent_id,
    updated_at
FROM open_block_invitations 
WHERE updated_at > NOW() - INTERVAL '5 minutes'
ORDER BY updated_at DESC;

-- Check if any care children were created
SELECT 
    COUNT(*) as care_children_count
FROM scheduled_care_children 
WHERE notes LIKE '%Open block acceptance%'
    AND created_at > NOW() - INTERVAL '5 minutes';

-- Check if any care blocks were created
SELECT 
    COUNT(*) as care_blocks_count
FROM scheduled_care 
WHERE notes LIKE '%Open block acceptance%'
    AND created_at > NOW() - INTERVAL '5 minutes';

-- Check the test response that was created
SELECT 
    id,
    invitation_id,
    parent_id,
    response,
    child_id,
    notes,
    created_at
FROM open_block_responses 
WHERE notes = 'Test trigger response - new invitation'
ORDER BY created_at DESC 
LIMIT 1;
