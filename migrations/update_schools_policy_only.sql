-- Update schools table RLS policy to allow public access
-- Run this if you already have the schools table deployed

-- Step 1: Drop existing read policy (it might have different names)
DO $$
BEGIN
    -- Try to drop the old authenticated-only policy
    DROP POLICY IF EXISTS "Allow all authenticated users to read schools" ON schools;
    -- Also try the new name in case it exists
    DROP POLICY IF EXISTS "Allow all users to read schools" ON schools;
    RAISE NOTICE 'Old policies dropped (if they existed)';
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Could not drop old policies: %', SQLERRM;
END $$;

-- Step 2: Create new public policy for reading schools
CREATE POLICY "Allow all users to read schools"
    ON schools
    FOR SELECT
    TO public
    USING (true);

-- Step 3: Verify the policies
SELECT
    schemaname,
    tablename,
    policyname,
    roles,
    cmd,
    qual
FROM pg_policies
WHERE tablename = 'schools'
ORDER BY policyname;

-- You should see two policies:
-- 1. "Allow all users to read schools" with roles = {public} and cmd = SELECT
-- 2. "Allow service role to manage schools" with roles = {service_role} and cmd = ALL
