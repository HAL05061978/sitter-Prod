-- Quick Test and Fix
-- This script checks the current state and applies the trigger fix

-- 1. Check current invitation status
SELECT '=== CURRENT INVITATION STATUS ===' as info;

SELECT 
    id,
    status,
    accepted_parent_id,
    updated_at
FROM open_block_invitations 
WHERE id = '193e024b-0b72-4ebd-a280-2768d95b6be9';

-- 2. Check if trigger exists
SELECT '=== TRIGGER EXISTS ===' as info;

SELECT 
    trigger_name,
    event_manipulation,
    event_object_table,
    action_timing
FROM information_schema.triggers 
WHERE trigger_name = 'handle_open_block_acceptance_trigger';

-- 3. If trigger doesn't exist, create it
SELECT '=== CREATING TRIGGER ===' as info;

-- Drop existing trigger and function
DROP TRIGGER IF EXISTS handle_open_block_acceptance_trigger ON open_block_responses;
DROP FUNCTION IF EXISTS handle_open_block_acceptance();

-- Create the trigger function
CREATE OR REPLACE FUNCTION handle_open_block_acceptance()
RETURNS TRIGGER AS $$
BEGIN
    -- Log that the trigger fired
    RAISE NOTICE 'Trigger fired for response: %', NEW.id;
    RAISE NOTICE 'Invitation ID: %', NEW.invitation_id;
    RAISE NOTICE 'Parent ID: %', NEW.parent_id;
    RAISE NOTICE 'Response: %', NEW.response;
    
    -- Only process accept responses
    IF NEW.response = 'accept' THEN
        RAISE NOTICE 'Processing accept response...';
        
        -- Update the invitation status
        UPDATE open_block_invitations 
        SET 
            status = 'accepted',
            accepted_parent_id = NEW.parent_id,
            updated_at = NOW()
        WHERE id = NEW.invitation_id;
        
        RAISE NOTICE 'Updated invitation status to accepted';
        
        -- Get the invitation record
        DECLARE
            invitation_record open_block_invitations%ROWTYPE;
            original_care_block scheduled_care%ROWTYPE;
            accepting_child_id UUID;
            original_parent_id UUID;
            original_child_id UUID;
        BEGIN
            -- Get the invitation
            SELECT * INTO invitation_record
            FROM open_block_invitations 
            WHERE id = NEW.invitation_id;
            
            IF invitation_record.id IS NULL THEN
                RAISE NOTICE 'No invitation found for ID: %', NEW.invitation_id;
                RETURN NEW;
            END IF;
            
            RAISE NOTICE 'Found invitation: status=%, invited_parent_id=%', 
                invitation_record.status, invitation_record.invited_parent_id;
            
            -- Get the original care block
            SELECT * INTO original_care_block
            FROM scheduled_care 
            WHERE id = invitation_record.open_block_id;
            
            IF original_care_block.id IS NULL THEN
                RAISE NOTICE 'No original care block found for ID: %', invitation_record.open_block_id;
                RETURN NEW;
            END IF;
            
            RAISE NOTICE 'Found original care block: %', original_care_block.id;
            
            -- Set variables
            accepting_child_id := NEW.child_id;
            original_parent_id := invitation_record.invited_parent_id;
            
            -- Get original child ID
            SELECT id INTO original_child_id
            FROM children 
            WHERE parent_id = original_parent_id 
            LIMIT 1;
            
            IF original_child_id IS NULL THEN
                RAISE NOTICE 'No child found for original parent: %', original_parent_id;
                RETURN NEW;
            END IF;
            
            RAISE NOTICE 'Original child ID: %', original_child_id;
            
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
                NEW.parent_id,
                original_care_block.start_time,
                original_care_block.end_time,
                'Open block acceptance - reciprocal care'
            );
            
            RAISE NOTICE 'Created reciprocal care block for accepting parent';
            
            -- Add the original child to the reciprocal care block
            INSERT INTO scheduled_care_children (
                scheduled_care_id,
                child_id,
                notes
            ) VALUES (
                (SELECT id FROM scheduled_care WHERE parent_id = NEW.parent_id AND notes = 'Open block acceptance - reciprocal care' ORDER BY created_at DESC LIMIT 1),
                original_child_id,
                'Open block acceptance - reciprocal child'
            );
            
            RAISE NOTICE 'Added reciprocal child to care block';
            
            -- Expire other invitations for the same open block
            UPDATE open_block_invitations 
            SET 
                status = 'expired',
                updated_at = NOW()
            WHERE open_block_id = invitation_record.open_block_id 
                AND id != NEW.invitation_id
                AND status = 'active';
            
            RAISE NOTICE 'Expired other invitations for this open block';
            
            RAISE NOTICE 'Open block acceptance process completed successfully';
        END;
    ELSE
        RAISE NOTICE 'Response is not accept: %', NEW.response;
    END IF;
    
    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Error in trigger function: %', SQLERRM;
        RAISE NOTICE 'SQLSTATE: %', SQLSTATE;
        RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create the trigger
CREATE TRIGGER handle_open_block_acceptance_trigger
    AFTER INSERT ON open_block_responses
    FOR EACH ROW
    EXECUTE FUNCTION handle_open_block_acceptance();

-- 4. Verify trigger was created
SELECT '=== TRIGGER CREATION VERIFICATION ===' as info;

SELECT 
    trigger_name,
    event_manipulation,
    event_object_table,
    action_timing
FROM information_schema.triggers 
WHERE trigger_name = 'handle_open_block_acceptance_trigger';

-- 5. Test the trigger by creating a new response
SELECT '=== TESTING TRIGGER ===' as info;

-- Create a test response to trigger the function
INSERT INTO open_block_responses (
    invitation_id,
    parent_id,
    response,
    child_id,
    notes
) VALUES (
    '193e024b-0b72-4ebd-a280-2768d95b6be9',
    '8c7b93f6-582d-4208-9cdd-65a940a1d18d',
    'accept',
    '7d88bd93-2ad1-4560-ad06-47ae9e769fa7',
    'Test trigger response - fixed trigger'
);

-- 6. Check the results
SELECT '=== TEST RESULTS ===' as info;

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
