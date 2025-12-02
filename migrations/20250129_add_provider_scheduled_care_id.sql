-- =====================================================
-- ADD: provider_scheduled_care_id column to track both care blocks
-- Problem: Receiver and Provider have different care block IDs
-- Solution: Store both IDs in the session
-- =====================================================

-- Add new column for provider's care block ID
ALTER TABLE location_tracking_sessions
ADD COLUMN IF NOT EXISTS provider_scheduled_care_id UUID REFERENCES scheduled_care(id) ON DELETE CASCADE;

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_location_sessions_provider_care
  ON location_tracking_sessions(provider_scheduled_care_id);

COMMENT ON COLUMN location_tracking_sessions.provider_scheduled_care_id
  IS 'The scheduled_care ID from the provider''s perspective (for reciprocal care)';

-- Drop the old confirm_dropoff function (2 parameters)
DROP FUNCTION IF EXISTS confirm_dropoff(UUID, UUID);

-- Create new confirm_dropoff function with 3 parameters
CREATE OR REPLACE FUNCTION confirm_dropoff(
  p_session_id UUID,
  p_provider_id UUID,
  p_provider_scheduled_care_id UUID  -- NEW: Pass the provider's care block ID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSON;
BEGIN
  -- Update session to active AND set the provider_id and provider's care block ID
  UPDATE location_tracking_sessions
  SET
    provider_id = p_provider_id,  -- Set provider to whoever is confirming
    provider_scheduled_care_id = p_provider_scheduled_care_id,  -- Set provider's care block
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

COMMENT ON FUNCTION confirm_dropoff IS 'Confirms drop-off and sets provider_id and provider_scheduled_care_id';

-- Update get_active_tracking_sessions to check both care block IDs
DROP FUNCTION IF EXISTS get_active_tracking_sessions(UUID);

CREATE OR REPLACE FUNCTION get_active_tracking_sessions(
  p_user_id UUID
)
RETURNS TABLE (
  session_id UUID,
  scheduled_care_id UUID,
  provider_id UUID,
  provider_name TEXT,
  receiver_id UUID,
  receiver_name TEXT,
  status TEXT,
  dropoff_requested_at TIMESTAMPTZ,
  dropoff_confirmed_at TIMESTAMPTZ,
  pickup_requested_at TIMESTAMPTZ,
  care_date TEXT,
  start_time TEXT,
  end_time TEXT,
  latest_location JSON
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    lts.id as session_id,
    lts.scheduled_care_id,
    lts.provider_id,
    COALESCE(p1.full_name, 'Unknown') as provider_name,
    lts.receiver_id,
    COALESCE(p2.full_name, 'Unknown') as receiver_name,
    lts.status,
    lts.dropoff_requested_at,
    lts.dropoff_confirmed_at,
    lts.pickup_requested_at,
    -- Return as TEXT to avoid casting issues
    to_char(sc.start_time, 'YYYY-MM-DD') as care_date,
    to_char(sc.start_time, 'HH24:MI') as start_time,
    to_char(sc.end_time, 'HH24:MI') as end_time,
    (
      SELECT json_build_object(
        'latitude', lu.latitude,
        'longitude', lu.longitude,
        'accuracy', lu.accuracy,
        'recorded_at', lu.recorded_at
      )
      FROM location_updates lu
      WHERE lu.session_id = lts.id
      ORDER BY lu.recorded_at DESC
      LIMIT 1
    ) as latest_location
  FROM location_tracking_sessions lts
  LEFT JOIN profiles p1 ON lts.provider_id = p1.id
  LEFT JOIN profiles p2 ON lts.receiver_id = p2.id
  JOIN scheduled_care sc ON lts.scheduled_care_id = sc.id
  WHERE lts.status IN ('pending_dropoff', 'active', 'pending_pickup')
    AND (
      -- User is explicitly in the session
      lts.provider_id = p_user_id OR lts.receiver_id = p_user_id
      OR
      -- OR find sessions for reciprocal care blocks with matching related_request_id and time
      EXISTS (
        SELECT 1 FROM scheduled_care sc_user
        WHERE (sc_user.parent_id = p_user_id OR EXISTS (
          SELECT 1 FROM scheduled_care_children scc_user
          JOIN children c_user ON c_user.id = scc_user.child_id
          WHERE scc_user.scheduled_care_id = sc_user.id
          AND c_user.parent_id = p_user_id
        ))
        AND EXISTS (
          SELECT 1 FROM scheduled_care sc_session
          WHERE sc_session.id = lts.scheduled_care_id
          AND sc_session.related_request_id = sc_user.related_request_id
          AND sc_session.related_request_id IS NOT NULL
          AND sc_session.start_time = sc_user.start_time
          AND sc_session.end_time = sc_user.end_time
        )
      )
    )
  ORDER BY lts.created_at DESC;
END;
$$;

COMMENT ON FUNCTION get_active_tracking_sessions IS 'Returns sessions for user''s care blocks including reciprocal blocks';
