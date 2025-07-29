-- Debug invitation data
-- Run this in Supabase SQL editor

-- Check what invitations exist
SELECT 
  id,
  group_id,
  inviter_id,
  invitee_id,
  request_id,
  invitation_date,
  invitation_start_time,
  invitation_end_time,
  invitation_duration_minutes,
  status,
  notes,
  created_at
FROM group_invitations
ORDER BY created_at DESC;

-- Check if there are any invitations for the current user
SELECT 
  gi.id,
  gi.invitation_date,
  gi.invitation_start_time,
  gi.invitation_end_time,
  gi.invitation_duration_minutes,
  gi.status,
  gi.notes,
  p.full_name as inviter_name
FROM group_invitations gi
JOIN profiles p ON gi.inviter_id = p.id
WHERE gi.invitee_id = auth.uid()
  AND gi.status = 'pending'
ORDER BY gi.created_at DESC;

-- Check the structure of group_invitations table
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'group_invitations'
ORDER BY ordinal_position;

-- Test the get_available_time_blocks_for_invitation function
-- (Replace 'some-invitation-id' with an actual invitation ID from above)
-- SELECT * FROM get_available_time_blocks_for_invitation('some-invitation-id');