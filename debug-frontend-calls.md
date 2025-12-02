# Debug Frontend RPC Calls

## The Problem
The frontend is calling RPC functions but getting 404/400 errors. We need to see exactly what the frontend is calling.

## Step 1: Check Browser Network Tab
1. Open browser developer tools (F12)
2. Go to Network tab
3. Reload the page
4. Look for failed RPC requests
5. Click on one of the failed requests
6. Check the "Request URL" and "Request Headers"

## Step 2: Check What Functions Actually Exist
Run this SQL to see what functions exist:
```sql
SELECT routine_name, routine_type
FROM information_schema.routines 
WHERE routine_schema = 'public' 
    AND routine_name LIKE '%get%'
ORDER BY routine_name;
```

## Step 3: Check Function Parameters
Run this SQL to see function parameters:
```sql
SELECT 
    p.routine_name,
    p.parameter_name,
    p.data_type,
    p.parameter_mode
FROM information_schema.parameters p
WHERE p.specific_schema = 'public'
    AND p.routine_name IN (
        'get_open_block_invitations',
        'get_reciprocal_care_requests',
        'get_responses_for_requester',
        'get_reschedule_requests',
        'activate_child_in_group'
    )
ORDER BY p.routine_name, p.ordinal_position;
```

## Step 4: Test Functions Directly
Run this SQL to test if functions work:
```sql
-- Test with a dummy UUID
SELECT * FROM get_open_block_invitations('00000000-0000-0000-0000-000000000000');
```

## Common Issues
1. **Function doesn't exist** - Need to create it
2. **Wrong parameters** - Function exists but parameters don't match
3. **Permissions** - Function exists but user can't call it
4. **Table doesn't exist** - Function exists but references missing table
5. **RLS blocking** - Function exists but RLS policies block access

## Next Steps
1. Run the diagnostic SQL above
2. Check browser network tab for exact URLs
3. Compare what frontend calls vs what exists in database
4. Fix the mismatch


