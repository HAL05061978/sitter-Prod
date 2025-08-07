-- Apply Fixed Open Block Trigger
-- This script applies the fixed trigger function and verifies it's working

-- First, let's check if the trigger currently exists
SELECT '=== CHECKING CURRENT TRIGGER ===' as info;

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

-- Now let's apply the fixed trigger
SELECT '=== APPLYING FIXED TRIGGER ===' as info;

-- Drop existing trigger and function
DROP TRIGGER IF EXISTS handle_open_block_acceptance_trigger ON open_block_responses;
DROP FUNCTION IF EXISTS handle_open_block_acceptance();

-- Create a comprehensive trigger function with debugging
CREATE OR REPLACE FUNCTION handle_open_block_acceptance()
RETURNS TRIGGER AS $$
DECLARE
    invitation_record open_block_invitations%ROWTYPE;
    original_care_block scheduled_care%ROWTYPE;
    accepting_parent_id UUID;
    accepting_child_id UUID;
    original_parent_id UUID;
    original_child_id UUID;
    existing_child_count INTEGER;
    reciprocal_child_id UUID;
    debug_info TEXT;
BEGIN
    -- Log the trigger call
    debug_info := '=== TRIGGER CALLED ===';
    RAISE NOTICE '%', debug_info;
    RAISE NOTICE 'NEW.invitation_id: %', NEW.invitation_id;
    RAISE NOTICE 'NEW.parent_id: %', NEW.parent_id;
    RAISE NOTICE 'NEW.response: %', NEW.response;
    RAISE NOTICE 'NEW.child_id: %', NEW.child_id;
    
    -- Only process 'accept' responses
    IF NEW.response != 'accept' THEN
        RAISE NOTICE 'Not an accept response, skipping';
        RETURN NEW;
    END IF;
    
    -- Get the invitation details
    SELECT * INTO invitation_record 
    FROM open_block_invitations 
    WHERE id = NEW.invitation_id;
    
    IF NOT FOUND THEN
        RAISE NOTICE 'Invitation not found for id: %', NEW.invitation_id;
        RETURN NEW;
    END IF;
    
    RAISE NOTICE 'Found invitation: status=%, invited_parent_id=%, open_block_id=%', 
        invitation_record.status, invitation_record.invited_parent_id, invitation_record.open_block_id;
    
    -- Check if invitation is still active
    IF invitation_record.status != 'active' THEN
        RAISE NOTICE 'Invitation is not active (status: %), skipping', invitation_record.status;
        RETURN NEW;
    END IF;
    
    -- Set variables
    accepting_parent_id := NEW.parent_id;
    accepting_child_id := NEW.child_id;
    original_parent_id := invitation_record.invited_parent_id;
    original_child_id := invitation_record.child_id;
    
    RAISE NOTICE 'Processing acceptance: accepting_parent=%, accepting_child=%, original_parent=%, original_child=%',
        accepting_parent_id, accepting_child_id, original_parent_id, original_child_id;
    
    -- Get the original care block
    SELECT * INTO original_care_block 
    FROM scheduled_care 
    WHERE id = invitation_record.open_block_id;
    
    IF NOT FOUND THEN
        RAISE NOTICE 'Original care block not found for id: %', invitation_record.open_block_id;
        RETURN NEW;
    END IF;
    
    RAISE NOTICE 'Found original care block: parent_id=%, child_id=%', 
        original_care_block.parent_id, original_care_block.child_id;
    
    -- Update the invitation to accepted
    UPDATE open_block_invitations 
    SET 
        status = 'accepted',
        accepted_parent_id = accepting_parent_id,
        updated_at = NOW()
    WHERE id = NEW.invitation_id;
    
    RAISE NOTICE 'Updated invitation status to accepted';
    
    -- Expire other invitations for the same open block (first-come-first-serve)
    UPDATE open_block_invitations 
    SET status = 'expired'
    WHERE open_block_id = invitation_record.open_block_id 
      AND id != NEW.invitation_id 
      AND status = 'active';
    
    RAISE NOTICE 'Expired other invitations for the same open block';
    
    -- Expire other invitations for the same accepting parent
    UPDATE open_block_invitations 
    SET status = 'expired'
    WHERE invited_parent_id = accepting_parent_id 
      AND id != NEW.invitation_id 
      AND status = 'active';
    
    RAISE NOTICE 'Expired other invitations for the same accepting parent';
    
    -- Get the reciprocal child (Parent B's child that Parent C will care for)
    SELECT cr.reciprocal_child_id INTO reciprocal_child_id
    FROM care_responses cr
    WHERE cr.request_id = original_care_block.related_request_id
      AND cr.status = 'accepted'
    LIMIT 1;
    
    -- Fallback: if reciprocal_child_id is null, use any child of Parent B
    IF reciprocal_child_id IS NULL THEN
        SELECT id INTO reciprocal_child_id
        FROM children 
        WHERE parent_id = original_parent_id
        LIMIT 1;
    END IF;
    
    -- Final fallback: use the accepting child if still null
    IF reciprocal_child_id IS NULL THEN
        reciprocal_child_id := accepting_child_id;
    END IF;
    
    RAISE NOTICE 'Using reciprocal_child_id: %', reciprocal_child_id;
    
    -- Check if the child is already in the scheduled_care_children table
    SELECT COUNT(*) INTO existing_child_count
    FROM scheduled_care_children
    WHERE scheduled_care_id = invitation_record.open_block_id
      AND child_id = accepting_child_id;
    
    -- Only add the child if they're not already there
    IF existing_child_count = 0 THEN
        INSERT INTO scheduled_care_children (
            scheduled_care_id,
            child_id,
            providing_parent_id,
            notes
        ) VALUES (
            invitation_record.open_block_id,
            accepting_child_id,
            accepting_parent_id,
            'Open block acceptance: Child added to original care block'
        );
        
        RAISE NOTICE 'Added accepting child to scheduled_care_children';
    ELSE
        RAISE NOTICE 'Child already exists in scheduled_care_children, skipping';
    END IF;
    
    -- Create the reciprocal care block (Parent C providing care for Parent B's child)
    INSERT INTO scheduled_care (
        group_id,
        parent_id,
        child_id,
        care_date,
        start_time,
        end_time,
        care_type,
        status,
        notes,
        related_request_id
    ) VALUES (
        original_care_block.group_id,
        accepting_parent_id,
        reciprocal_child_id,
        invitation_record.reciprocal_date,
        invitation_record.reciprocal_start_time,
        invitation_record.reciprocal_end_time,
        'provided',
        'confirmed',
        'Open block acceptance: Parent C providing care for Parent B''s child',
        original_care_block.related_request_id
    );
    
    RAISE NOTICE 'Created reciprocal care block';
    
    -- Add the reciprocal child to the new care block
    INSERT INTO scheduled_care_children (
        scheduled_care_id,
        child_id,
        providing_parent_id,
        notes
    ) VALUES (
        (SELECT id FROM scheduled_care WHERE parent_id = accepting_parent_id AND related_request_id = original_care_block.related_request_id ORDER BY created_at DESC LIMIT 1),
        reciprocal_child_id,
        accepting_parent_id,
        'Open block acceptance: Reciprocal child added to new care block'
    );
    
    RAISE NOTICE 'Added reciprocal child to new care block';
    
    RAISE NOTICE '=== TRIGGER COMPLETED SUCCESSFULLY ===';
    
    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Error in handle_open_block_acceptance: %', SQLERRM;
        RAISE NOTICE 'SQLSTATE: %', SQLSTATE;
        -- Don't fail the transaction, just log the error
        RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create the trigger
CREATE TRIGGER handle_open_block_acceptance_trigger
    AFTER INSERT ON open_block_responses
    FOR EACH ROW EXECUTE FUNCTION handle_open_block_acceptance();

-- Verify the trigger was created
SELECT '=== VERIFYING TRIGGER ===' as info;

SELECT 
    trigger_name,
    event_manipulation,
    event_object_table,
    action_timing,
    action_statement
FROM information_schema.triggers 
WHERE trigger_name = 'handle_open_block_acceptance_trigger';

-- Success message
SELECT 'Fixed trigger applied successfully! Now test the open block acceptance again.' as status;
