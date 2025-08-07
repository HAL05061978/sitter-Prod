-- Recreate Trigger Simple
-- This script recreates the trigger with minimal complexity

-- First, drop existing trigger and function
DROP TRIGGER IF EXISTS handle_open_block_acceptance_trigger ON open_block_responses;
DROP FUNCTION IF EXISTS handle_open_block_acceptance();

-- Create a simple trigger function
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

-- Verify the trigger was created
SELECT '=== TRIGGER CREATION VERIFICATION ===' as info;

SELECT 
    trigger_name,
    event_manipulation,
    event_object_table,
    action_timing,
    action_statement
FROM information_schema.triggers 
WHERE trigger_name = 'handle_open_block_acceptance_trigger';

-- Check if the function exists
SELECT 
    routine_name,
    routine_type
FROM information_schema.routines 
WHERE routine_name = 'handle_open_block_acceptance';

-- Check trigger enable status
SELECT 
    tgname as trigger_name,
    tgenabled as enabled,
    tgrelid::regclass as table_name
FROM pg_trigger 
WHERE tgname = 'handle_open_block_acceptance_trigger';
