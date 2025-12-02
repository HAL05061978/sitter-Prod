-- Migration: Fix child_group_members RLS policies
-- Run this in your Supabase SQL Editor

-- First, let's check current policies (you can run this separately to see what exists)
-- SELECT * FROM pg_policies WHERE tablename = 'child_group_members';

-- Drop existing policies to recreate them properly
DROP POLICY IF EXISTS "Users can view child group memberships for their groups" ON child_group_members;
DROP POLICY IF EXISTS "Users can insert child group memberships" ON child_group_members;
DROP POLICY IF EXISTS "Users can update child group memberships" ON child_group_members;
DROP POLICY IF EXISTS "Users can delete child group memberships" ON child_group_members;
DROP POLICY IF EXISTS "child_group_members_select" ON child_group_members;
DROP POLICY IF EXISTS "child_group_members_insert" ON child_group_members;
DROP POLICY IF EXISTS "child_group_members_update" ON child_group_members;
DROP POLICY IF EXISTS "child_group_members_delete" ON child_group_members;

-- Enable RLS if not already enabled
ALTER TABLE child_group_members ENABLE ROW LEVEL SECURITY;

-- SELECT policy: Users can view memberships in groups they belong to
CREATE POLICY "Users can view child group memberships"
  ON child_group_members FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM group_members gm
      WHERE gm.group_id = child_group_members.group_id
      AND gm.profile_id = auth.uid()
      AND gm.status = 'active'
    )
  );

-- INSERT policy: Users can add children to groups they belong to
-- They can add their own children OR they must be a member of the group
CREATE POLICY "Users can insert child group memberships"
  ON child_group_members FOR INSERT
  WITH CHECK (
    -- User must be adding the child (added_by must be the current user)
    added_by = auth.uid()
    AND
    -- User must be a member of the group
    EXISTS (
      SELECT 1 FROM group_members gm
      WHERE gm.group_id = child_group_members.group_id
      AND gm.profile_id = auth.uid()
      AND gm.status = 'active'
    )
    AND
    -- The child must belong to the user
    EXISTS (
      SELECT 1 FROM children c
      WHERE c.id = child_group_members.child_id
      AND c.parent_id = auth.uid()
    )
  );

-- UPDATE policy: Users can update memberships for their own children in their groups
CREATE POLICY "Users can update child group memberships"
  ON child_group_members FOR UPDATE
  USING (
    -- User must be a member of the group
    EXISTS (
      SELECT 1 FROM group_members gm
      WHERE gm.group_id = child_group_members.group_id
      AND gm.profile_id = auth.uid()
      AND gm.status = 'active'
    )
    AND
    -- The child must belong to the user
    EXISTS (
      SELECT 1 FROM children c
      WHERE c.id = child_group_members.child_id
      AND c.parent_id = auth.uid()
    )
  );

-- DELETE policy: Users can remove their own children from groups
CREATE POLICY "Users can delete child group memberships"
  ON child_group_members FOR DELETE
  USING (
    -- User must be a member of the group
    EXISTS (
      SELECT 1 FROM group_members gm
      WHERE gm.group_id = child_group_members.group_id
      AND gm.profile_id = auth.uid()
      AND gm.status = 'active'
    )
    AND
    -- The child must belong to the user
    EXISTS (
      SELECT 1 FROM children c
      WHERE c.id = child_group_members.child_id
      AND c.parent_id = auth.uid()
    )
  );

-- Grant permissions
GRANT ALL ON child_group_members TO authenticated;

-- Verify the policies were created
SELECT policyname, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'child_group_members';
