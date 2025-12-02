# Diagnose Pet Care Counter Issue

## Problem
Requesting pet owner not seeing messages/scheduler counter tick up when they receive pet care responses.

## Root Cause
The `get_pet_care_responses_for_requester` function needs to have the correct filters deployed.

## Step 1: Verify Function is Deployed with Correct Filters

Run this query in Supabase SQL Editor to check the function:

```sql
-- Check if function exists and view its definition
SELECT routine_name, routine_definition
FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_name = 'get_pet_care_responses_for_requester';
```

**Expected**: You should see the function with filters including:
- `pcr.response_type = 'pending'`
- `pcr.status IN ('submitted', 'accepted', 'declined')`
- `pcrq.request_type = 'reciprocal'`

**If not visible or missing filters**: Re-deploy migration #2:
```
migrations/20250115000026_add_get_pet_care_responses_for_requester.sql
```

## Step 2: Test the Function Manually

Replace `YOUR_USER_ID` with your actual user ID and run:

```sql
-- Test if function returns your submitted pet care responses
SELECT * FROM get_pet_care_responses_for_requester('YOUR_USER_ID');
```

**Expected**: Should return rows for pet care responses with status='submitted'

**If empty**: Check if there are any submitted responses:

```sql
-- Check raw data
SELECT
    pcr.id as response_id,
    pcr.status,
    pcr.response_type,
    pcrq.request_type,
    pcrq.requester_id
FROM pet_care_responses pcr
JOIN pet_care_requests pcrq ON pcr.request_id = pcrq.id
WHERE pcrq.requester_id = 'YOUR_USER_ID'
ORDER BY pcr.created_at DESC;
```

## Step 3: Check Frontend is Calling the Function

1. Open browser console (F12)
2. Go to Network tab
3. Filter for "get_pet_care_responses_for_requester"
4. Refresh the page
5. Click on the request

**Expected**: Should see the RPC call being made
**If 404 error**: Function not deployed
**If 400/500 error**: Function has an error

## Step 4: Verify Counter Logic

The counter in Header.tsx counts responses where `status === 'submitted'`.

Check console for any CounterDebugger logs about pet care responses.

## Common Issues & Fixes

### Issue 1: Function Not Deployed
**Solution**: Deploy migration #2
```
migrations/20250115000026_add_get_pet_care_responses_for_requester.sql
```

### Issue 2: Function Deployed Without Filters
**Solution**: Re-deploy migration #2 (the function was updated to add filters)

### Issue 3: No 'submitted' Responses in Database
**Solution**:
1. Have another parent submit a response to your pet care request
2. Check that `submit_pet_care_response` is setting status='submitted'
3. Verify with Step 2 query above

### Issue 4: Browser Cache
**Solution**:
1. Hard refresh: Cmd+Shift+R (Mac) or Ctrl+Shift+R (Windows)
2. Clear localStorage
3. Close and reopen browser

## Quick Fix Steps

1. **Re-deploy migration #2**:
   - Open Supabase SQL Editor
   - Run entire contents of:
     `migrations/20250115000026_add_get_pet_care_responses_for_requester.sql`

2. **Hard refresh your app**:
   - Press Cmd+Shift+R (Mac) or Ctrl+Shift+R (Windows)

3. **Test**:
   - Have someone submit a response to your pet care request
   - Counter should increment

## Expected Behavior

When a group member submits a response to your pet care request:

1. ✅ `submit_pet_care_response` function creates response with `status='submitted'`
2. ✅ Notification created for you with type `'care_response'`
3. ✅ `get_pet_care_responses_for_requester` returns the response
4. ✅ Header.tsx counter filters for `status === 'submitted'`
5. ✅ Counter increments by number of unique requests with submitted responses

## Debugging Queries

### Check All Pet Care Responses for Your Requests
```sql
SELECT
    pcr.id as response_id,
    pcrq.id as request_id,
    pcrq.requester_id,
    pcr.responder_id,
    pcr.status,
    pcr.response_type,
    pcrq.request_type,
    pcr.created_at
FROM pet_care_responses pcr
JOIN pet_care_requests pcrq ON pcr.request_id = pcrq.id
WHERE pcrq.requester_id = 'YOUR_USER_ID'
ORDER BY pcr.created_at DESC;
```

### Check What the Function Returns
```sql
SELECT * FROM get_pet_care_responses_for_requester('YOUR_USER_ID');
```

### Compare with Child Care Function
```sql
-- Child care responses (for comparison)
SELECT * FROM get_responses_for_requester('YOUR_USER_ID');

-- Pet care responses
SELECT * FROM get_pet_care_responses_for_requester('YOUR_USER_ID');
```

Both should return similar structured data for submitted responses.
