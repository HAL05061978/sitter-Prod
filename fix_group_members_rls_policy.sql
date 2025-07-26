-- Temporary fix for RLS policy on group_members table
-- This allows all authenticated users to see group members to fix the notification issue

-- Drop the existing SELECT policy
DROP POLICY IF EXISTS "Allow group members to select group members" ON group_members;

-- Create a temporary SELECT policy that allows all authenticated users to see group members
-- This will fix the notification issue while we work on a better RLS approach
CREATE POLICY "Allow group members to select group members" ON group_members
    FOR SELECT
    USING (auth.role() = 'authenticated');

-- Also ensure the UPDATE policy allows members to update their own status
DROP POLICY IF EXISTS "Debug allow all update" ON group_members;
DROP POLICY IF EXISTS "Allow members to update their own status" ON group_members;

CREATE POLICY "Allow members to update their own status" ON group_members
    FOR UPDATE
    USING (profile_id = auth.uid())
    WITH CHECK (profile_id = auth.uid());

-- Grant necessary permissions
GRANT SELECT ON group_members TO authenticated;
GRANT UPDATE ON group_members TO authenticated; 