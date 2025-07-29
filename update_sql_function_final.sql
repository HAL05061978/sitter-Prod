-- Final update to the select_response_and_reject_others function
-- Run this in Supabase SQL editor to ensure the function is updated

DROP FUNCTION IF EXISTS select_response_and_reject_others(UUID);

CREATE OR REPLACE FUNCTION select_response_and_reject_others(
  p_response_id UUID
)
RETURNS VOID AS $$
DECLARE
  v_response request_responses%ROWTYPE;
  v_request babysitting_requests%ROWTYPE;
  v_responder_child_id UUID;
  v_initiator_child_id UUID;
  v_reciprocal_date DATE;
  v_reciprocal_start_time TIME;
  v_reciprocal_end_time TIME;
  v_reciprocal_child_id UUID;
BEGIN
  -- Get the response details
  SELECT * INTO v_response FROM request_responses WHERE id = p_response_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Response not found';
  END IF;
  
  -- Get the original request details
  SELECT * INTO v_request FROM babysitting_requests WHERE id = v_response.request_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Request not found';
  END IF;
  
  -- Mark this response as accepted
  UPDATE request_responses 
  SET status = 'accepted' 
  WHERE id = p_response_id;
  
  -- Reject all other pending responses for this request
  UPDATE request_responses 
  SET status = 'rejected' 
  WHERE request_id = v_response.request_id 
    AND id != p_response_id 
    AND status = 'pending';
  
  -- Close the original request
  UPDATE babysitting_requests 
  SET status = 'closed' 
  WHERE id = v_response.request_id;
  
  -- Get responder's child ID (the child they want care for)
  v_reciprocal_child_id := v_response.reciprocal_child_id;
  
  -- Get initiator's child ID (the child from the original request)
  v_initiator_child_id := v_request.child_id;
  
  -- Get reciprocal care details from the response
  v_reciprocal_date := v_response.reciprocal_date;
  v_reciprocal_start_time := v_response.reciprocal_start_time;
  v_reciprocal_end_time := v_response.reciprocal_end_time;
  
  -- Create scheduled blocks for the original request (Parent A needs care, Parent B provides)
  INSERT INTO scheduled_blocks (
    group_id,
    parent_id,
    child_id,
    scheduled_date,
    start_time,
    end_time,
    duration_minutes,
    block_type,
    status,
    request_id,
    notes
  ) VALUES (
    v_request.group_id,
    v_request.initiator_id,
    v_initiator_child_id,
    v_request.requested_date,
    v_request.start_time,
    v_request.end_time,
    v_request.duration_minutes,
    'care_needed',
    'confirmed',
    v_request.id,
    v_request.notes
  );
  
  INSERT INTO scheduled_blocks (
    group_id,
    parent_id,
    child_id,
    scheduled_date,
    start_time,
    end_time,
    duration_minutes,
    block_type,
    status,
    request_id,
    notes
  ) VALUES (
    v_request.group_id,
    v_response.responder_id,
    v_initiator_child_id,
    v_request.requested_date,
    v_request.start_time,
    v_request.end_time,
    v_request.duration_minutes,
    'care_provided',
    'confirmed',
    v_request.id,
    v_response.notes
  );
  
  -- Create scheduled blocks for reciprocal care (Parent B needs care, Parent A provides)
  -- Only create reciprocal blocks if the responder specified reciprocal care details
  IF v_reciprocal_child_id IS NOT NULL AND v_reciprocal_date IS NOT NULL 
     AND v_reciprocal_start_time IS NOT NULL AND v_reciprocal_end_time IS NOT NULL THEN
    
    -- Calculate duration for reciprocal care
    DECLARE
      v_reciprocal_duration_minutes INTEGER;
    BEGIN
      v_reciprocal_duration_minutes := EXTRACT(EPOCH FROM (v_reciprocal_end_time::time - v_reciprocal_start_time::time)) / 60;
      
      INSERT INTO scheduled_blocks (
        group_id,
        parent_id,
        child_id,
        scheduled_date,
        start_time,
        end_time,
        duration_minutes,
        block_type,
        status,
        request_id,
        notes
      ) VALUES (
        v_request.group_id,
        v_response.responder_id,
        v_reciprocal_child_id,
        v_reciprocal_date,
        v_reciprocal_start_time,
        v_reciprocal_end_time,
        v_reciprocal_duration_minutes,
        'care_needed',
        'confirmed',
        v_request.id,
        v_response.notes
      );
      
      INSERT INTO scheduled_blocks (
        group_id,
        parent_id,
        child_id,
        scheduled_date,
        start_time,
        end_time,
        duration_minutes,
        block_type,
        status,
        request_id,
        notes
      ) VALUES (
        v_request.group_id,
        v_request.initiator_id,
        v_reciprocal_child_id,
        v_reciprocal_date,
        v_reciprocal_start_time,
        v_reciprocal_end_time,
        v_reciprocal_duration_minutes,
        'care_provided',
        'confirmed',
        v_request.id,
        v_request.notes
      );
      
      RAISE NOTICE 'Created reciprocal care blocks for child % on date % with times %-%', 
        v_reciprocal_child_id, v_reciprocal_date, v_reciprocal_start_time, v_reciprocal_end_time;
    END;
  ELSE
    RAISE NOTICE 'No reciprocal care details provided, skipping reciprocal blocks. Reciprocal data: date=%, start=%, end=%, child=%', 
      v_reciprocal_date, v_reciprocal_start_time, v_reciprocal_end_time, v_reciprocal_child_id;
  END IF;
  
  RAISE NOTICE 'Successfully processed response % for request %', p_response_id, v_response.request_id;
END;
$$ LANGUAGE plpgsql;