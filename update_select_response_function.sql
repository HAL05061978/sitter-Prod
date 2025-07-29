-- Update the select_response_and_reject_others function to fix duplicate blocks issue
-- This script should be run in your Supabase SQL editor

-- Function to select one response and reject all other responses to the same request
CREATE OR REPLACE FUNCTION select_response_and_reject_others(
  p_selected_response_id UUID,
  p_request_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_response RECORD;
  v_request RECORD;
  v_responder_child_id UUID;
  v_initiator_child_id UUID;
BEGIN
  -- First, reject all other responses to this request
  UPDATE public.request_responses 
  SET status = 'rejected'
  WHERE request_id = p_request_id 
    AND id != p_selected_response_id
    AND status = 'pending';
  
  -- Then, mark the selected response as accepted
  UPDATE public.request_responses 
  SET status = 'accepted'
  WHERE id = p_selected_response_id;
  
  -- Update the request status to closed since we have an accepted response
  UPDATE public.babysitting_requests 
  SET status = 'closed'
  WHERE id = p_request_id;
  
  -- Get the selected response details
  SELECT * INTO v_response FROM public.request_responses WHERE id = p_selected_response_id;
  
  -- Get the request details
  SELECT * INTO v_request FROM public.babysitting_requests WHERE id = p_request_id;
  
  -- Get the responder's child (assuming they have one child for simplicity)
  SELECT id INTO v_responder_child_id
  FROM public.children
  WHERE parent_id = v_response.responder_id
  LIMIT 1;
  
  -- Get the initiator's child
  v_initiator_child_id := v_request.child_id;
  
  -- Create scheduled blocks for the accepted response
  INSERT INTO public.scheduled_blocks (
    group_id, parent_id, child_id, scheduled_date, start_time, end_time, 
    duration_minutes, block_type, status, notes
  ) VALUES 
  -- Parent A's care needed (original request)
  (
    v_request.group_id, v_request.initiator_id, v_initiator_child_id,
    v_request.requested_date, v_request.start_time, v_request.end_time,
    v_request.duration_minutes, 'care_needed', 'confirmed', v_request.notes
  ),
  -- Parent B's care provided (response)
  (
    v_request.group_id, v_response.responder_id, v_initiator_child_id,
    v_request.requested_date, v_request.start_time, v_request.end_time,
    v_request.duration_minutes, 'care_provided', 'confirmed', v_response.notes
  );
  
  -- If the responder has a child, create reciprocal blocks for the same date/time
  IF v_responder_child_id IS NOT NULL AND v_responder_child_id != v_initiator_child_id THEN
    INSERT INTO public.scheduled_blocks (
      group_id, parent_id, child_id, scheduled_date, start_time, end_time, 
      duration_minutes, block_type, status, notes
    ) VALUES 
    -- Parent B's care needed (reciprocal - for responder's child)
    (
      v_request.group_id, v_response.responder_id, v_responder_child_id,
      v_request.requested_date, v_request.start_time, v_request.end_time,
      v_request.duration_minutes, 'care_needed', 'confirmed', v_response.notes
    ),
    -- Parent A's care provided (reciprocal - for responder's child)
    (
      v_request.group_id, v_request.initiator_id, v_responder_child_id,
      v_request.requested_date, v_request.start_time, v_request.end_time,
      v_request.duration_minutes, 'care_provided', 'confirmed', v_request.notes
    );
  END IF;
  
  RAISE NOTICE 'Selected response % and rejected other responses for request %. Responder child: %, Initiator child: %', 
    p_selected_response_id, p_request_id, v_responder_child_id, v_initiator_child_id;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION select_response_and_reject_others(UUID, UUID) TO authenticated; 