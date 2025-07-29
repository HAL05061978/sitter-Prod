-- Fix Initial Care Exchange (Parent A ↔ Parent B)
-- This ensures that when Parent A accepts Parent B's response, calendar blocks are created correctly
-- Run this in your Supabase SQL editor

-- ============================================================================
-- STEP 1: Fix the create_care_exchange function for initial Parent A ↔ Parent B agreement
-- ============================================================================

DROP FUNCTION IF EXISTS create_care_exchange(UUID, UUID);

CREATE OR REPLACE FUNCTION create_care_exchange(
  p_request_id UUID,
  p_response_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_response RECORD;
  v_request RECORD;
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
  
  -- Generate a care group ID to link related blocks
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
    
    RAISE NOTICE 'Created reciprocal care blocks for child % on date %', v_responder_child_id, v_response.reciprocal_date;
  ELSE
    RAISE NOTICE 'No reciprocal care details provided, skipping reciprocal blocks';
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
$$;

-- ============================================================================
-- STEP 2: Grant permissions
-- ============================================================================

GRANT EXECUTE ON FUNCTION create_care_exchange(UUID, UUID) TO authenticated;

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================

SELECT 'Initial care exchange fixed! The system now:
1. Creates correct care_needed/care_provided blocks for Parent A ↔ Parent B
2. Links blocks with care_group_id for child aggregation
3. Handles reciprocal care when Parent B specifies their own care needs
4. Properly closes requests and rejects other responses' as status; 