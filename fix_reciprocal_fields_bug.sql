-- Fix for missing reciprocal care fields in request_responses table
-- This script adds the missing fields that are expected by the frontend

-- Add missing reciprocal care fields to request_responses table
ALTER TABLE public.request_responses 
ADD COLUMN IF NOT EXISTS reciprocal_date DATE,
ADD COLUMN IF NOT EXISTS reciprocal_start_time TIME,
ADD COLUMN IF NOT EXISTS reciprocal_end_time TIME,
ADD COLUMN IF NOT EXISTS reciprocal_duration_minutes INTEGER,
ADD COLUMN IF NOT EXISTS reciprocal_child_id UUID REFERENCES public.children(id) ON DELETE SET NULL;

-- Add constraint to ensure reciprocal fields are consistent (only if it doesn't exist)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE table_name = 'request_responses' 
        AND constraint_name = 'valid_reciprocal_time_range'
    ) THEN
        ALTER TABLE public.request_responses 
        ADD CONSTRAINT valid_reciprocal_time_range CHECK (
            (response_type != 'agree') OR 
            (reciprocal_child_id IS NULL AND reciprocal_date IS NULL AND reciprocal_start_time IS NULL AND reciprocal_end_time IS NULL AND reciprocal_duration_minutes IS NULL) OR
            (reciprocal_child_id IS NOT NULL AND reciprocal_date IS NOT NULL AND reciprocal_start_time IS NOT NULL AND reciprocal_end_time IS NOT NULL AND reciprocal_duration_minutes IS NOT NULL AND reciprocal_end_time > reciprocal_start_time)
        );
    END IF;
END $$;

-- Add comments to document the new fields
COMMENT ON COLUMN public.request_responses.reciprocal_date IS 'Date when the responder needs reciprocal care for their child';
COMMENT ON COLUMN public.request_responses.reciprocal_start_time IS 'Start time for reciprocal care';
COMMENT ON COLUMN public.request_responses.reciprocal_end_time IS 'End time for reciprocal care';
COMMENT ON COLUMN public.request_responses.reciprocal_duration_minutes IS 'Duration of reciprocal care in minutes';
COMMENT ON COLUMN public.request_responses.reciprocal_child_id IS 'Child ID for whom the responder needs reciprocal care';

-- Create or replace the create_care_exchange function to properly handle reciprocal care
CREATE OR REPLACE FUNCTION create_care_exchange(
    p_request_id UUID,
    p_response_id UUID
) RETURNS VOID AS $$
DECLARE
    v_request RECORD;
    v_response RECORD;
    v_initiator_child_id UUID;
    v_responder_child_id UUID;
    v_care_group_id UUID;
    v_reciprocal_duration_minutes INTEGER;
BEGIN
    -- Get the response details
    SELECT * INTO v_response FROM public.request_responses WHERE id = p_response_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Response not found';
    END IF;
    
    -- Get the request details
    SELECT * INTO v_request FROM public.babysitting_requests WHERE id = p_request_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Request not found';
    END IF;
    
    -- Get child IDs
    v_initiator_child_id := v_request.child_id;
    v_responder_child_id := v_response.reciprocal_child_id;
    
    -- Generate care group ID to link related blocks
    v_care_group_id := gen_random_uuid();
    
    -- Calculate reciprocal duration if provided
    IF v_response.reciprocal_start_time IS NOT NULL AND v_response.reciprocal_end_time IS NOT NULL THEN
        v_reciprocal_duration_minutes := EXTRACT(EPOCH FROM (v_response.reciprocal_end_time::time - v_response.reciprocal_start_time::time)) / 60;
    ELSE
        v_reciprocal_duration_minutes := v_request.duration_minutes;
    END IF;
    
    -- Create scheduled blocks for the original request (Parent A needs care, Parent B provides)
    INSERT INTO public.scheduled_blocks (
        group_id, parent_id, child_id, scheduled_date, start_time, end_time, 
        duration_minutes, block_type, status, request_id, notes, care_group_id
    ) VALUES (
        v_request.group_id, v_request.initiator_id, v_initiator_child_id,
        v_request.requested_date, v_request.start_time, v_request.end_time,
        v_request.duration_minutes, 'care_needed', 'confirmed', v_request.id, v_request.notes, v_care_group_id
    );
    
    INSERT INTO public.scheduled_blocks (
        group_id, parent_id, child_id, scheduled_date, start_time, end_time, 
        duration_minutes, block_type, status, request_id, notes, care_group_id
    ) VALUES (
        v_request.group_id, v_response.responder_id, v_initiator_child_id,
        v_request.requested_date, v_request.start_time, v_request.end_time,
        v_request.duration_minutes, 'care_provided', 'confirmed', v_request.id, v_response.notes, v_care_group_id
    );
    
    -- Create scheduled blocks for reciprocal care (Parent B needs care, Parent A provides)
    -- Only create reciprocal blocks if the responder specified reciprocal care details
    IF v_responder_child_id IS NOT NULL AND v_response.reciprocal_date IS NOT NULL 
       AND v_response.reciprocal_start_time IS NOT NULL AND v_response.reciprocal_end_time IS NOT NULL THEN
        
        INSERT INTO public.scheduled_blocks (
            group_id, parent_id, child_id, scheduled_date, start_time, end_time, 
            duration_minutes, block_type, status, request_id, notes, care_group_id
        ) VALUES (
            v_request.group_id, v_response.responder_id, v_responder_child_id,
            v_response.reciprocal_date, v_response.reciprocal_start_time, v_response.reciprocal_end_time,
            v_reciprocal_duration_minutes, 'care_needed', 'confirmed', v_request.id, v_response.notes, v_care_group_id
        );
        
        INSERT INTO public.scheduled_blocks (
            group_id, parent_id, child_id, scheduled_date, start_time, end_time, 
            duration_minutes, block_type, status, request_id, notes, care_group_id
        ) VALUES (
            v_request.group_id, v_request.initiator_id, v_responder_child_id,
            v_response.reciprocal_date, v_response.reciprocal_start_time, v_response.reciprocal_end_time,
            v_reciprocal_duration_minutes, 'care_provided', 'confirmed', v_request.id, v_request.notes, v_care_group_id
        );
        
        RAISE NOTICE 'Created reciprocal care blocks for child % on date % with times %-%', 
            v_responder_child_id, v_response.reciprocal_date, v_response.reciprocal_start_time, v_response.reciprocal_end_time;
    ELSE
        RAISE NOTICE 'No reciprocal care details provided, skipping reciprocal blocks. Reciprocal data: date=%, start=%, end=%, child=%', 
            v_response.reciprocal_date, v_response.reciprocal_start_time, v_response.reciprocal_end_time, v_responder_child_id;
    END IF;
    
    -- Mark response as accepted
    UPDATE public.request_responses 
    SET status = 'accepted'
    WHERE id = p_response_id;
    
    -- Reject all other pending responses for this request
    UPDATE public.request_responses 
    SET status = 'rejected'
    WHERE request_id = p_request_id 
      AND id != p_response_id 
      AND status = 'pending';
    
    -- Close the request
    UPDATE public.babysitting_requests 
    SET status = 'closed'
    WHERE id = p_request_id;
    
    RAISE NOTICE 'Successfully processed care exchange for request % and response % with care group %', p_request_id, p_response_id, v_care_group_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission on the function
GRANT EXECUTE ON FUNCTION create_care_exchange(UUID, UUID) TO authenticated;

-- Create index for better performance on reciprocal fields
CREATE INDEX IF NOT EXISTS idx_request_responses_reciprocal_child_id ON public.request_responses(reciprocal_child_id);
CREATE INDEX IF NOT EXISTS idx_request_responses_reciprocal_date ON public.request_responses(reciprocal_date);

-- Success message
SELECT 'Reciprocal care fields added successfully! Response details should now be properly captured.' as status; 