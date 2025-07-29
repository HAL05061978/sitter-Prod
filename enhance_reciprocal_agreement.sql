-- Enhance Reciprocal Agreement System
-- This script modifies the system to allow Parent B to specify their own reciprocal care needs when agreeing

-- Step 1: Add reciprocal fields back to request_responses table
ALTER TABLE public.request_responses 
ADD COLUMN IF NOT EXISTS reciprocal_child_id UUID REFERENCES public.children(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS reciprocal_date DATE,
ADD COLUMN IF NOT EXISTS reciprocal_start_time TIME,
ADD COLUMN IF NOT EXISTS reciprocal_end_time TIME,
ADD COLUMN IF NOT EXISTS reciprocal_duration_minutes INTEGER;

-- Step 2: Drop the old trigger and function
DROP TRIGGER IF EXISTS create_initial_scheduled_blocks_trigger ON public.request_responses;
DROP FUNCTION IF EXISTS create_initial_scheduled_blocks();

-- Step 3: Create enhanced function for reciprocal agreements
CREATE OR REPLACE FUNCTION create_reciprocal_scheduled_blocks() RETURNS TRIGGER AS $$
DECLARE
    v_request RECORD;
    v_initiator_child_id UUID;
    v_responder_child_id UUID;
    v_duration_minutes INTEGER;
    v_reciprocal_duration_minutes INTEGER;
BEGIN
    -- Only proceed if this is an 'agree' response
    IF NEW.response_type != 'agree' THEN
        RETURN NEW;
    END IF;
    
    -- Get the request details
    SELECT * INTO v_request
    FROM public.babysitting_requests
    WHERE id = NEW.request_id;
    
    -- Get the initiator's child
    v_initiator_child_id := v_request.child_id;
    
    -- Get the responder's child (from reciprocal fields)
    v_responder_child_id := NEW.reciprocal_child_id;
    
    -- Calculate durations
    v_duration_minutes := v_request.duration_minutes;
    v_reciprocal_duration_minutes := NEW.reciprocal_duration_minutes;
    
    -- Create scheduled blocks for the reciprocal agreement
    -- 1. Parent A needs care (original request)
    INSERT INTO public.scheduled_blocks (
        group_id, parent_id, child_id, scheduled_date, start_time, end_time, 
        duration_minutes, block_type, status, notes
    ) VALUES (
        v_request.group_id, v_request.initiator_id, v_initiator_child_id,
        v_request.requested_date, v_request.start_time, v_request.end_time,
        v_duration_minutes, 'care_needed', 'confirmed', v_request.notes
    );
    
    -- 2. Parent B provides care for Parent A's child
    INSERT INTO public.scheduled_blocks (
        group_id, parent_id, child_id, scheduled_date, start_time, end_time, 
        duration_minutes, block_type, status, notes
    ) VALUES (
        v_request.group_id, NEW.responder_id, v_initiator_child_id,
        v_request.requested_date, v_request.start_time, v_request.end_time,
        v_duration_minutes, 'care_provided', 'confirmed', v_request.notes
    );
    
    -- 3. Parent B needs care (reciprocal - only if reciprocal data provided)
    IF NEW.reciprocal_child_id IS NOT NULL AND NEW.reciprocal_date IS NOT NULL THEN
        INSERT INTO public.scheduled_blocks (
            group_id, parent_id, child_id, scheduled_date, start_time, end_time, 
            duration_minutes, block_type, status, notes
        ) VALUES (
            v_request.group_id, NEW.responder_id, v_responder_child_id,
            NEW.reciprocal_date, NEW.reciprocal_start_time, NEW.reciprocal_end_time,
            v_reciprocal_duration_minutes, 'care_needed', 'confirmed', 
            COALESCE(NEW.notes, 'Reciprocal care arrangement')
        );
        
        -- 4. Parent A provides care for Parent B's child
        INSERT INTO public.scheduled_blocks (
            group_id, parent_id, child_id, scheduled_date, start_time, end_time, 
            duration_minutes, block_type, status, notes
        ) VALUES (
            v_request.group_id, v_request.initiator_id, v_responder_child_id,
            NEW.reciprocal_date, NEW.reciprocal_start_time, NEW.reciprocal_end_time,
            v_reciprocal_duration_minutes, 'care_provided', 'confirmed', 
            COALESCE(NEW.notes, 'Reciprocal care arrangement')
        );
    END IF;
    
    -- Close the request
    UPDATE public.babysitting_requests
    SET status = 'closed'
    WHERE id = NEW.request_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 4: Create trigger for enhanced reciprocal agreements
CREATE TRIGGER create_reciprocal_scheduled_blocks_trigger
    AFTER INSERT ON public.request_responses
    FOR EACH ROW
    EXECUTE FUNCTION create_reciprocal_scheduled_blocks();

-- Step 5: Add constraint to ensure reciprocal data is complete when provided
ALTER TABLE public.request_responses 
ADD CONSTRAINT valid_reciprocal_data CHECK (
    (reciprocal_child_id IS NULL AND reciprocal_date IS NULL AND reciprocal_start_time IS NULL AND reciprocal_end_time IS NULL AND reciprocal_duration_minutes IS NULL) OR
    (reciprocal_child_id IS NOT NULL AND reciprocal_date IS NOT NULL AND reciprocal_start_time IS NOT NULL AND reciprocal_end_time IS NOT NULL AND reciprocal_duration_minutes IS NOT NULL AND reciprocal_end_time > reciprocal_start_time)
);

-- Step 6: Grant permissions
GRANT EXECUTE ON FUNCTION create_reciprocal_scheduled_blocks() TO authenticated;

-- Success message
SELECT 'Reciprocal agreement system enhanced! Parent B can now specify their own care needs when agreeing.' as status; 