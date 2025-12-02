# Fix: School Dropdown Not Working on Signup Page

## Problem
School dropdown works in Dashboard but not on Signup page. Console shows "Setting 0 schools for index 0".

## Root Cause
The schools table RLS (Row Level Security) policy was set to only allow **authenticated** users to read schools. The Signup page runs **before** user authentication, so unauthenticated users cannot access the schools table.

## Solution
Update the RLS policy to allow **public** (including anonymous/unauthenticated) access to the schools table for SELECT operations.

## Steps to Fix

### Option 1: Via Supabase Dashboard (Recommended)

1. Go to your Supabase Dashboard: https://supabase.com/dashboard
2. Select your project
3. Navigate to **SQL Editor**
4. Copy and paste this SQL:

```sql
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
```

5. Click **Run**
6. Verify the output shows the new policy

### Option 2: Run the Fix Script

Run the file `migrations/fix_schools_rls_policy.sql` in your Supabase SQL Editor.

### Option 3: If Starting Fresh

If you haven't deployed the schools table yet, just run the updated `migrations/create_schools_table.sql` which now includes the correct public policy.

## Verification

After applying the fix:

1. Go to your Signup page
2. Enter ZIP code **06611** in a child's ZIP code field
3. Town should auto-populate as "Trumbull"
4. School dropdown should appear with 9 schools
5. Console should show:
   ```
   Setting 9 schools for index 0
   Available schools state updated: {0: Array(9)}
   ```

## Why This Is Safe

Making schools readable by public users is safe because:

1. **Schools are public reference data** - School names and locations are not sensitive information
2. **Read-only access** - Anonymous users can only SELECT (read), not INSERT/UPDATE/DELETE
3. **No user data exposed** - The schools table contains no user-specific information
4. **Required for signup flow** - Users need to see schools before creating an account

## Security Notes

- Only **SELECT** (read) operations are allowed for public
- **INSERT/UPDATE/DELETE** operations still require service_role access
- The schools table contains no sensitive or user-specific data
- This is a standard pattern for reference/lookup tables (like countries, states, etc.)

## Alternative Approaches (Not Recommended)

If you absolutely need to restrict school access to authenticated users only:

1. **Pre-populate school data in the frontend** - Include schools in a JavaScript file
2. **Use a public API endpoint** - Create an Edge Function that bypasses RLS
3. **Delay school selection** - Only show school dropdown after signup

These alternatives are more complex and provide no real security benefit for public reference data.

## Related Files

- `migrations/create_schools_table.sql` - Initial migration (now updated)
- `migrations/fix_schools_rls_policy.sql` - Quick fix script
- `app/signup/page.tsx` - Signup page implementation
- `app/lib/zipcode-utils.ts` - ZIP code lookup utilities
