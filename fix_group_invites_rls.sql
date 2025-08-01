-- Fix RLS policies for group_invites table
-- Allow invitees to update their own invitations when accepting/rejecting

-- First, drop existing policies
DROP POLICY IF EXISTS "Users can view invitations sent to their email" ON public.group_invites;
DROP POLICY IF EXISTS "Users can insert invitations they create" ON public.group_invites;
DROP POLICY IF EXISTS "Users can update invitations they created" ON public.group_invites;

-- Create new policies that allow invitees to update their invitations
CREATE POLICY "Users can view invitations sent to their email" ON public.group_invites
  FOR SELECT USING (
    auth.jwt() ->> 'email' = email
  );

CREATE POLICY "Users can insert invitations they create" ON public.group_invites
  FOR INSERT WITH CHECK (
    auth.uid() = invited_by
  );

CREATE POLICY "Users can update invitations they received" ON public.group_invites
  FOR UPDATE USING (
    auth.jwt() ->> 'email' = email
  );

-- Verify the policies were created
SELECT 
  policyname,
  cmd,
  qual
FROM pg_policies 
WHERE tablename = 'group_invites'
ORDER BY policyname; 