-- Test Trigger Function Manually
-- This script will manually test the trigger function to see if it has errors

-- First, let's check if the function exists and get its definition
SELECT '=== FUNCTION DEFINITION ===' as info;

SELECT 
    routine_name,
    routine_type,
    routine_definition
FROM information_schema.routines 
WHERE routine_name = 'handle_open_block_acceptance';

-- Now let's manually test the function with the actual data
SELECT '=== MANUAL FUNCTION TEST ===' as info;

DO $$
DECLARE
    test_response open_block_responses%ROWTYPE;
    invitation_record open_block_invitations%ROWTYPE;
    original_care_block scheduled_care%ROWTYPE;
    accepting_parent_id UUID;
    accepting_child_id UUID;
    original_parent_id UUID;
    original_child_id UUID;
    existing_child_count INTEGER;
    reciprocal_child_id UUID;
    debug_message TEXT;
BEGIN
    -- Get the test response that was created
    SELECT * INTO test_response
    FROM open_block_responses 
    WHERE notes = 'Test trigger response - new invitation'
    ORDER BY created_at DESC 
    LIMIT 1;
    
    IF test_response.id IS NULL THEN
        RAISE NOTICE 'No test response found';
        RETURN;
    END IF;
    
    RAISE NOTICE 'Testing with response: %', test_response.id;
    RAISE NOTICE 'Invitation ID: %', test_response.invitation_id;
    RAISE NOTICE 'Parent ID: %', test_response.parent_id;
    RAISE NOTICE 'Response: %', test_response.response;
    RAISE NOTICE 'Child ID: %', test_response.child_id;
    
    -- Get the invitation record
    SELECT * INTO invitation_record
    FROM open_block_invitations 
    WHERE id = test_response.invitation_id;
    
    IF invitation_record.id IS NULL THEN
        RAISE NOTICE 'No invitation found for ID: %', test_response.invitation_id;
        RETURN;
    END IF;
    
    RAISE NOTICE 'Invitation status before: %', invitation_record.status;
    RAISE NOTICE 'Invitation accepted_parent_id before: %', invitation_record.accepted_parent_id;
    
    -- Set variables that the trigger function would use
    accepting_parent_id := test_response.parent_id;
    accepting_child_id := test_response.child_id;
    original_parent_id := invitation_record.invited_parent_id;
    
    -- Get original child ID
    SELECT id INTO original_child_id
    FROM children 
    WHERE parent_id = original_parent_id 
    LIMIT 1;
    
    IF original_child_id IS NULL THEN
        RAISE NOTICE 'No child found for original parent: %', original_parent_id;
        RETURN;
    END IF;
    
    RAISE NOTICE 'Original child ID: %', original_child_id;
    
    -- Check if this is an accept response
    IF test_response.response = 'accept' THEN
        RAISE NOTICE 'Processing accept response...';
        
        -- Update the invitation status
        UPDATE open_block_invitations 
        SET 
            status = 'accepted',
            accepted_parent_id = accepting_parent_id,
            updated_at = NOW()
        WHERE id = test_response.invitation_id;
        
        RAISE NOTICE 'Updated invitation status to accepted';
        
        -- Get the original care block
        SELECT * INTO original_care_block
        FROM scheduled_care 
        WHERE id = invitation_record.open_block_id;
        
        IF original_care_block.id IS NULL THEN
            RAISE NOTICE 'No original care block found for ID: %', invitation_record.open_block_id;
            RETURN;
        END IF;
        
        RAISE NOTICE 'Original care block found: %', original_care_block.id;
        
        -- Check existing children count
        SELECT COUNT(*) INTO existing_child_count
        FROM scheduled_care_children 
        WHERE scheduled_care_id = original_care_block.id;
        
        RAISE NOTICE 'Existing children count: %', existing_child_count;
        
        -- Add the accepting child to the care block
        INSERT INTO scheduled_care_children (
            scheduled_care_id,
            child_id,
            notes
        ) VALUES (
            original_care_block.id,
            accepting_child_id,
            'Open block acceptance - accepting child'
        );
        
        RAISE NOTICE 'Added accepting child to care block';
        
        -- Create reciprocal care block for the accepting parent
        INSERT INTO scheduled_care (
            parent_id,
            start_time,
            end_time,
            notes
        ) VALUES (
            accepting_parent_id,
            original_care_block.start_time,
            original_care_block.end_time,
            'Open block acceptance - reciprocal care'
        );
        
        RAISE NOTICE 'Created reciprocal care block for accepting parent';
        
        -- Get the reciprocal child ID
        SELECT id INTO reciprocal_child_id
        FROM children 
        WHERE parent_id = original_parent_id 
        LIMIT 1;
        
        IF reciprocal_child_id IS NOT NULL THEN
            -- Add the original child to the reciprocal care block
            INSERT INTO scheduled_care_children (
                scheduled_care_id,
                child_id,
                notes
            ) VALUES (
                (SELECT id FROM scheduled_care WHERE parent_id = accepting_parent_id AND notes = 'Open block acceptance - reciprocal care' ORDER BY created_at DESC LIMIT 1),
                reciprocal_child_id,
                'Open block acceptance - reciprocal child'
            );
            
            RAISE NOTICE 'Added reciprocal child to care block';
        END IF;
        
        -- Expire other invitations for the same open block
        UPDATE open_block_invitations 
        SET 
            status = 'expired',
            updated_at = NOW()
        WHERE open_block_id = invitation_record.open_block_id 
            AND id != test_response.invitation_id
            AND status = 'active';
        
        RAISE NOTICE 'Expired other invitations for this open block';
        
        RAISE NOTICE 'Open block acceptance process completed successfully';
        
    ELSE
        RAISE NOTICE 'Response is not accept: %', test_response.response;
    END IF;
    
    -- Check final invitation status
    SELECT status, accepted_parent_id INTO invitation_record.status, invitation_record.accepted_parent_id
    FROM open_block_invitations 
    WHERE id = test_response.invitation_id;
    
    RAISE NOTICE 'Final invitation status: %', invitation_record.status;
    RAISE NOTICE 'Final accepted_parent_id: %', invitation_record.accepted_parent_id;
    
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Error in manual function test: %', SQLERRM;
        RAISE NOTICE 'SQLSTATE: %', SQLSTATE;
        RAISE NOTICE 'Error detail: %', SQLERRM;
END $$;

-- Check the results after manual test
SELECT '=== MANUAL TEST RESULTS ===' as info;

-- Check invitation status
SELECT 
    id,
    status,
    accepted_parent_id,
    updated_at
FROM open_block_invitations 
WHERE id = '193e024b-0b72-4ebd-a280-2768d95b6be9';

-- Check if care children were created
SELECT 
    COUNT(*) as care_children_count
FROM scheduled_care_children 
WHERE notes LIKE '%Open block acceptance%'
    AND created_at > NOW() - INTERVAL '5 minutes';

-- Check if care blocks were created
SELECT 
    COUNT(*) as care_blocks_count
FROM scheduled_care 
WHERE notes LIKE '%Open block acceptance%'
    AND created_at > NOW() - INTERVAL '5 minutes';
