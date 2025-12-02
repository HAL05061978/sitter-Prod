-- =====================================================
-- SIMPLIFICATION: Use logged-in user for all operations
-- =====================================================
-- This migration simplifies the location tracking logic:
-- 1. request_dropoff: Use logged-in user as receiver_id
-- 2. confirm_dropoff: Use logged-in user as provider_id (and update it)
-- 3. No more guessing from database relationships
-- =====================================================

-- =====================================================
-- FUNCTION: confirm_dropoff (UPDATED)
-- Now sets provider_id from the logged-in user who confirms
-- =====================================================
CREATE OR REPLACE FUNCTION confirm_dropoff(
  p_session_id UUID,
  p_provider_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSON;
BEGIN
  -- Update session to active AND set the provider_id
  UPDATE location_tracking_sessions
  SET
    provider_id = p_provider_id,  -- Set provider to whoever is confirming
    status = 'active',
    dropoff_confirmed_at = NOW(),
    updated_at = NOW()
  WHERE id = p_session_id
    AND status = 'pending_dropoff';

  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Session not found or already confirmed'
    );
  END IF;

  -- TODO: Send push notification to receiver

  RETURN json_build_object(
    'success', true,
    'message', 'Drop-off confirmed. Location tracking started.'
  );
END;
$$;

COMMENT ON FUNCTION confirm_dropoff IS 'Confirms drop-off and sets provider_id from logged-in user';

-- =====================================================
-- FUNCTION: confirm_pickup (UPDATED)
-- Validate that correct user is confirming
-- =====================================================
CREATE OR REPLACE FUNCTION confirm_pickup(
  p_session_id UUID,
  p_provider_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSON;
BEGIN
  -- Update session to completed
  UPDATE location_tracking_sessions
  SET
    status = 'completed',
    pickup_confirmed_at = NOW(),
    updated_at = NOW()
  WHERE id = p_session_id
    AND provider_id = p_provider_id
    AND status = 'pending_pickup';

  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Session not found, already completed, or you are not the provider'
    );
  END IF;

  -- TODO: Send push notification to receiver

  RETURN json_build_object(
    'success', true,
    'message', 'Pick-up confirmed. Location tracking stopped.'
  );
END;
$$;

COMMENT ON FUNCTION confirm_pickup IS 'Confirms pick-up and stops location tracking';
