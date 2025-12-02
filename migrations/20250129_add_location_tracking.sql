-- =====================================================
-- Migration: Add Location Tracking for Care Blocks
-- =====================================================
-- This migration adds:
-- 1. location_tracking_sessions table - tracks drop-off/pick-up sessions
-- 2. location_updates table - stores real-time location coordinates
-- 3. Functions for managing location sharing lifecycle
-- 4. RLS policies for secure access
-- =====================================================

-- =====================================================
-- TABLE: location_tracking_sessions
-- Tracks when location sharing is active for a care block
-- =====================================================
CREATE TABLE IF NOT EXISTS location_tracking_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scheduled_care_id UUID NOT NULL REFERENCES scheduled_care(id) ON DELETE CASCADE,
  provider_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  receiver_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Session lifecycle
  status TEXT NOT NULL DEFAULT 'pending_dropoff' CHECK (status IN (
    'pending_dropoff',      -- Waiting for drop-off confirmation
    'active',               -- Currently tracking (child dropped off)
    'pending_pickup',       -- Waiting for pick-up confirmation
    'completed',            -- Session ended (child picked up)
    'cancelled'             -- Session cancelled
  )),

  -- Timestamps for workflow
  dropoff_requested_at TIMESTAMPTZ,
  dropoff_confirmed_at TIMESTAMPTZ,
  pickup_requested_at TIMESTAMPTZ,
  pickup_confirmed_at TIMESTAMPTZ,

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ensure only one active session per care block (partial unique index)
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_active_session
  ON location_tracking_sessions(scheduled_care_id, status)
  WHERE status IN ('pending_dropoff', 'active', 'pending_pickup');

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_location_sessions_scheduled_care
  ON location_tracking_sessions(scheduled_care_id);
CREATE INDEX IF NOT EXISTS idx_location_sessions_provider
  ON location_tracking_sessions(provider_id);
CREATE INDEX IF NOT EXISTS idx_location_sessions_receiver
  ON location_tracking_sessions(receiver_id);
CREATE INDEX IF NOT EXISTS idx_location_sessions_status
  ON location_tracking_sessions(status);

-- =====================================================
-- TABLE: location_updates
-- Stores real-time GPS coordinates during active tracking
-- =====================================================
CREATE TABLE IF NOT EXISTS location_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES location_tracking_sessions(id) ON DELETE CASCADE,
  provider_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Location data
  latitude DECIMAL(10, 7) NOT NULL,
  longitude DECIMAL(10, 7) NOT NULL,
  accuracy DECIMAL(10, 2),  -- Accuracy in meters
  altitude DECIMAL(10, 2),  -- Altitude in meters (optional)
  heading DECIMAL(5, 2),    -- Heading in degrees (optional)
  speed DECIMAL(10, 2),     -- Speed in m/s (optional)

  -- Timestamp
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_location_updates_session
  ON location_updates(session_id);
CREATE INDEX IF NOT EXISTS idx_location_updates_provider
  ON location_updates(provider_id);
CREATE INDEX IF NOT EXISTS idx_location_updates_recorded
  ON location_updates(recorded_at DESC);

-- =====================================================
-- RLS POLICIES
-- =====================================================

-- Enable RLS
ALTER TABLE location_tracking_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE location_updates ENABLE ROW LEVEL SECURITY;

-- location_tracking_sessions policies
DROP POLICY IF EXISTS "Users can view their own tracking sessions" ON location_tracking_sessions;
CREATE POLICY "Users can view their own tracking sessions"
ON location_tracking_sessions FOR SELECT
TO authenticated
USING (
  provider_id = auth.uid() OR receiver_id = auth.uid()
);

DROP POLICY IF EXISTS "Providers can create tracking sessions" ON location_tracking_sessions;
CREATE POLICY "Providers can create tracking sessions"
ON location_tracking_sessions FOR INSERT
TO authenticated
WITH CHECK (provider_id = auth.uid());

DROP POLICY IF EXISTS "Users can update their own sessions" ON location_tracking_sessions;
CREATE POLICY "Users can update their own sessions"
ON location_tracking_sessions FOR UPDATE
TO authenticated
USING (
  provider_id = auth.uid() OR receiver_id = auth.uid()
);

-- location_updates policies
DROP POLICY IF EXISTS "Users can view location updates for their sessions" ON location_updates;
CREATE POLICY "Users can view location updates for their sessions"
ON location_updates FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM location_tracking_sessions lts
    WHERE lts.id = session_id
    AND (lts.provider_id = auth.uid() OR lts.receiver_id = auth.uid())
  )
);

DROP POLICY IF EXISTS "Providers can insert location updates" ON location_updates;
CREATE POLICY "Providers can insert location updates"
ON location_updates FOR INSERT
TO authenticated
WITH CHECK (provider_id = auth.uid());

-- =====================================================
-- FUNCTION: request_dropoff
-- Called by receiving parent to indicate child is being dropped off
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
  v_provider_id UUID;
  v_session_id UUID;
  v_result JSON;
BEGIN
  -- Get the provider (parent_id from scheduled_care)
  SELECT parent_id INTO v_provider_id
  FROM scheduled_care
  WHERE id = p_scheduled_care_id;

  IF v_provider_id IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Care block not found'
    );
  END IF;

  -- Create or update tracking session
  INSERT INTO location_tracking_sessions (
    scheduled_care_id,
    provider_id,
    receiver_id,
    status,
    dropoff_requested_at
  ) VALUES (
    p_scheduled_care_id,
    v_provider_id,
    p_receiver_id,
    'pending_dropoff',
    NOW()
  )
  ON CONFLICT (scheduled_care_id, status)
  DO UPDATE SET
    dropoff_requested_at = NOW(),
    updated_at = NOW()
  RETURNING id INTO v_session_id;

  -- TODO: Send push notification to provider

  RETURN json_build_object(
    'success', true,
    'session_id', v_session_id,
    'message', 'Drop-off request sent to provider'
  );
END;
$$;

-- =====================================================
-- FUNCTION: confirm_dropoff
-- Called by providing parent to confirm drop-off and start tracking
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
  -- Update session to active
  UPDATE location_tracking_sessions
  SET
    status = 'active',
    dropoff_confirmed_at = NOW(),
    updated_at = NOW()
  WHERE id = p_session_id
    AND provider_id = p_provider_id
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
    'message', 'Drop-off confirmed. Location sharing started.'
  );
END;
$$;

-- =====================================================
-- FUNCTION: request_pickup
-- Called by receiving parent to indicate child is being picked up
-- =====================================================
CREATE OR REPLACE FUNCTION request_pickup(
  p_session_id UUID,
  p_receiver_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Update session to pending_pickup
  UPDATE location_tracking_sessions
  SET
    status = 'pending_pickup',
    pickup_requested_at = NOW(),
    updated_at = NOW()
  WHERE id = p_session_id
    AND receiver_id = p_receiver_id
    AND status = 'active';

  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Session not found or not active'
    );
  END IF;

  -- TODO: Send push notification to provider

  RETURN json_build_object(
    'success', true,
    'message', 'Pick-up request sent to provider'
  );
END;
$$;

-- =====================================================
-- FUNCTION: confirm_pickup
-- Called by providing parent to confirm pick-up and stop tracking
-- =====================================================
CREATE OR REPLACE FUNCTION confirm_pickup(
  p_session_id UUID,
  p_provider_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
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
      'error', 'Session not found or already completed'
    );
  END IF;

  -- TODO: Send push notification to receiver

  RETURN json_build_object(
    'success', true,
    'message', 'Pick-up confirmed. Location sharing stopped.'
  );
END;
$$;

-- =====================================================
-- FUNCTION: update_location
-- Called by providing parent's device to update location
-- =====================================================
CREATE OR REPLACE FUNCTION update_location(
  p_session_id UUID,
  p_latitude DECIMAL(10, 7),
  p_longitude DECIMAL(10, 7),
  p_accuracy DECIMAL(10, 2) DEFAULT NULL,
  p_altitude DECIMAL(10, 2) DEFAULT NULL,
  p_heading DECIMAL(5, 2) DEFAULT NULL,
  p_speed DECIMAL(10, 2) DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_provider_id UUID;
  v_session_active BOOLEAN;
BEGIN
  -- Check if session is active and get provider_id
  SELECT provider_id, (status = 'active')
  INTO v_provider_id, v_session_active
  FROM location_tracking_sessions
  WHERE id = p_session_id
    AND provider_id = auth.uid();

  IF v_provider_id IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Session not found or unauthorized'
    );
  END IF;

  IF NOT v_session_active THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Session is not active'
    );
  END IF;

  -- Insert location update
  INSERT INTO location_updates (
    session_id,
    provider_id,
    latitude,
    longitude,
    accuracy,
    altitude,
    heading,
    speed
  ) VALUES (
    p_session_id,
    v_provider_id,
    p_latitude,
    p_longitude,
    p_accuracy,
    p_altitude,
    p_heading,
    p_speed
  );

  RETURN json_build_object(
    'success', true,
    'message', 'Location updated'
  );
END;
$$;

-- =====================================================
-- FUNCTION: get_latest_location
-- Get the most recent location for a session
-- =====================================================
CREATE OR REPLACE FUNCTION get_latest_location(
  p_session_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_location JSON;
  v_authorized BOOLEAN;
BEGIN
  -- Check if user is authorized to view this session
  SELECT EXISTS (
    SELECT 1 FROM location_tracking_sessions
    WHERE id = p_session_id
    AND (provider_id = auth.uid() OR receiver_id = auth.uid())
  ) INTO v_authorized;

  IF NOT v_authorized THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Unauthorized'
    );
  END IF;

  -- Get latest location
  SELECT json_build_object(
    'latitude', latitude,
    'longitude', longitude,
    'accuracy', accuracy,
    'altitude', altitude,
    'heading', heading,
    'speed', speed,
    'recorded_at', recorded_at
  ) INTO v_location
  FROM location_updates
  WHERE session_id = p_session_id
  ORDER BY recorded_at DESC
  LIMIT 1;

  IF v_location IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'error', 'No location data available'
    );
  END IF;

  RETURN json_build_object(
    'success', true,
    'location', v_location
  );
END;
$$;

-- =====================================================
-- FUNCTION: get_active_tracking_sessions
-- Get all active tracking sessions for a user
-- =====================================================
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
  care_date DATE,
  start_time TIME,
  end_time TIME,
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
    p1.full_name as provider_name,
    lts.receiver_id,
    p2.full_name as receiver_name,
    lts.status,
    lts.dropoff_requested_at,
    lts.dropoff_confirmed_at,
    lts.pickup_requested_at,
    sc.start_time::DATE as care_date,
    sc.start_time::TIME as start_time,
    sc.end_time::TIME as end_time,
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
  JOIN profiles p1 ON lts.provider_id = p1.id
  JOIN profiles p2 ON lts.receiver_id = p2.id
  JOIN scheduled_care sc ON lts.scheduled_care_id = sc.id
  WHERE (lts.provider_id = p_user_id OR lts.receiver_id = p_user_id)
    AND lts.status IN ('pending_dropoff', 'active', 'pending_pickup')
  ORDER BY lts.created_at DESC;
END;
$$;

-- =====================================================
-- Add comment for documentation
-- =====================================================
COMMENT ON TABLE location_tracking_sessions IS 'Tracks location sharing sessions for care blocks';
COMMENT ON TABLE location_updates IS 'Stores real-time GPS coordinates during active tracking';
COMMENT ON FUNCTION request_dropoff IS 'Receiving parent requests drop-off confirmation';
COMMENT ON FUNCTION confirm_dropoff IS 'Providing parent confirms drop-off and enables location sharing';
COMMENT ON FUNCTION request_pickup IS 'Receiving parent requests pick-up confirmation';
COMMENT ON FUNCTION confirm_pickup IS 'Providing parent confirms pick-up and disables location sharing';
COMMENT ON FUNCTION update_location IS 'Providing parent updates their current location';
COMMENT ON FUNCTION get_latest_location IS 'Get the most recent location for a session';
COMMENT ON FUNCTION get_active_tracking_sessions IS 'Get all active tracking sessions for a user';
