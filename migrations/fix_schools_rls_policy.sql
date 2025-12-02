-- Fix schools table RLS policy to allow unauthenticated access
-- This is needed for the signup page to access schools

-- Drop the old policy if it exists
DROP POLICY IF EXISTS "Allow all authenticated users to read schools" ON schools;

-- Create new policy that allows public (including anonymous) access
CREATE POLICY "Allow all users to read schools"
    ON schools
    FOR SELECT
    TO public
    USING (true);

-- Verify the policy was created
SELECT schemaname, tablename, policyname, roles, cmd
FROM pg_policies
WHERE tablename = 'schools';
