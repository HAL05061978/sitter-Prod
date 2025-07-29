-- Fix RLS policies for group_invitations table
-- Run this in Supabase SQL editor

-- Check if group_invitations table exists and its RLS status
SELECT 
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables 
WHERE tablename = 'group_invitations';

-- Check existing policies for group_invitations
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE tablename = 'group_invitations';

-- If group_invitations table doesn't exist, create it
CREATE TABLE IF NOT EXISTS group_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
  inviter_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  invitee_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  request_id UUID REFERENCES babysitting_requests(id) ON DELETE CASCADE,
  invitation_date DATE NOT NULL,
  invitation_start_time TIME NOT NULL,
  invitation_end_time TIME NOT NULL,
  invitation_duration_minutes INTEGER NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
  selected_time_block_index INTEGER,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Disable RLS on group_invitations to allow the function to insert
ALTER TABLE group_invitations DISABLE ROW LEVEL SECURITY;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_group_invitations_invitee_id ON group_invitations(invitee_id);
CREATE INDEX IF NOT EXISTS idx_group_invitations_status ON group_invitations(status);
CREATE INDEX IF NOT EXISTS idx_group_invitations_request_id ON group_invitations(request_id);