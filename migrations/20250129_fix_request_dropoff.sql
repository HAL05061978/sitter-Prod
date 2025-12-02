-- =====================================================
-- FIX: Update request_dropoff function - simpler approach
-- Just use the logged-in user as receiver_id
-- =====================================================

CREATE OR REPLACE FUNCTION request_dropoff(
  p_scheduled_care_id UUID,
  p_receiver_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_session_id UUID;
  v_existing_session_id UUID;
  v_result JSON;
BEGIN
  -- Validate: receiver_id should not be null
  IF p_receiver_id IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Receiver ID is required'
    );
  END IF;

  -- Check if there's already an active session for this care block
  SELECT id INTO v_existing_session_id
  FROM location_tracking_sessions
  WHERE scheduled_care_id = p_scheduled_care_id
    AND status IN ('pending_dropoff', 'active', 'pending_pickup');

  IF v_existing_session_id IS NOT NULL THEN
    -- Update existing session
    UPDATE location_tracking_sessions
    SET
      receiver_id = p_receiver_id,  -- Update receiver in case it changed
      dropoff_requested_at = NOW(),
      updated_at = NOW()
    WHERE id = v_existing_session_id;

    v_session_id := v_existing_session_id;
  ELSE
    -- Create new tracking session
    -- Note: provider_id will be set when they confirm drop-off
    INSERT INTO location_tracking_sessions (
      scheduled_care_id,
      provider_id,
      receiver_id,
      status,
      dropoff_requested_at
    ) VALUES (
      p_scheduled_care_id,
      p_receiver_id,  -- Temporarily use receiver as provider until confirmed
      p_receiver_id,
      'pending_dropoff',
      NOW()
    )
    RETURNING id INTO v_session_id;
  END IF;

  -- TODO: Send push notification to provider

  RETURN json_build_object(
    'success', true,
    'session_id', v_session_id,
    'message', 'Drop-off request sent to provider'
  );
END;
$$;

-- Add comment
COMMENT ON FUNCTION request_dropoff IS 'Simplified - receiver_id from logged-in user, provider_id set on confirm';
