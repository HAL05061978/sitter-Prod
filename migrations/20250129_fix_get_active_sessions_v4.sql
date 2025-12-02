-- =====================================================
-- FIX: get_active_tracking_sessions - Show sessions for care blocks user participates in
-- Problem: Provider can't see pending sessions because provider_id not set yet
-- Solution: Look up sessions by scheduled_care blocks the user is involved in
-- =====================================================

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
      -- OR user's care block is involved (for pending sessions where provider not set yet)
      EXISTS (
        SELECT 1 FROM scheduled_care sc2
        WHERE sc2.id = lts.scheduled_care_id
        AND sc2.parent_id = p_user_id
      )
      OR
      -- OR user's child is involved in the care block
      EXISTS (
        SELECT 1 FROM scheduled_care_children scc
        JOIN children c ON c.id = scc.child_id
        WHERE scc.scheduled_care_id = lts.scheduled_care_id
        AND c.parent_id = p_user_id
      )
    )
  ORDER BY lts.created_at DESC;
END;
$$;

COMMENT ON FUNCTION get_active_tracking_sessions IS 'Returns active sessions for care blocks user is involved in (as provider, receiver, or participant)';
