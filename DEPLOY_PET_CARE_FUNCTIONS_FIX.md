# Pet Care Functions Fix - Deployment Guide

## Issue Summary
The pet care workflow was experiencing 404 errors because the query functions `get_reciprocal_pet_care_requests` and `get_reciprocal_pet_care_responses` were missing from the database. Additionally, the `accept_pet_care_response` function had bugs that prevented proper acceptance of responses.

## Problems Found
1. **404 Errors**: Missing `get_reciprocal_pet_care_requests` and `get_reciprocal_pet_care_responses` functions
2. **Response not found error**: The `accept_pet_care_response` function was not checking for 'submitted' status correctly
3. **Missing notifications**: Notifications were not being sent to responders
4. **Request status issues**: The request status was being updated before declining other responses

## Fixes Applied

### Migration 1: `20250123000005_add_pet_care_query_functions.sql`
Creates two missing query functions:
- `get_reciprocal_pet_care_requests(UUID)` - Returns pet care requests that need responses
- `get_reciprocal_pet_care_responses(UUID)` - Returns responses to my pet care requests

### Migration 2: `20250123000006_fix_accept_pet_care_response.sql`
Fixes the `accept_pet_care_response` function to:
- Check for 'submitted' status (not just any status)
- Decline other responses BEFORE updating the request
- Send notifications to both accepted and declined responders
- Properly update request status at the end

### Migration 3: `20250123000007_fix_pet_care_request_visibility.sql`
Fixes the visibility issue where responders see requests after submitting:
- Updates `get_reciprocal_pet_care_requests` to ONLY return 'pending' status
- Removes 'submitted' from the status filter
- Ensures requests disappear from responder's view after submission
- Requests only appear for requester to accept/decline after submission

## Deployment Steps

### Step 1: Run Migrations in Supabase SQL Editor

Copy and paste each migration file into the Supabase SQL Editor and run them in order:

1. First run: `migrations/20250123000005_add_pet_care_query_functions.sql`
2. Then run: `migrations/20250123000006_fix_accept_pet_care_response.sql`
3. Finally run: `migrations/20250123000007_fix_pet_care_request_visibility.sql`

### Step 2: Verify Functions Were Created

Run this query to verify all functions exist:

```sql
SELECT
    routine_name,
    routine_type,
    data_type as return_type
FROM information_schema.routines
WHERE routine_schema = 'public'
AND (
    routine_name = 'get_reciprocal_pet_care_requests'
    OR routine_name = 'get_reciprocal_pet_care_responses'
    OR routine_name = 'accept_pet_care_response'
)
ORDER BY routine_name;
```

You should see:
- `accept_pet_care_response` - FUNCTION - boolean
- `get_reciprocal_pet_care_requests` - FUNCTION - SETOF record
- `get_reciprocal_pet_care_responses` - FUNCTION - SETOF record

### Step 3: Test the Pet Care Workflow

1. **Test Request Query**:
```sql
SELECT * FROM get_reciprocal_pet_care_requests('YOUR_USER_ID');
```

2. **Test Response Query**:
```sql
SELECT * FROM get_reciprocal_pet_care_responses('YOUR_USER_ID');
```

3. **Test Accept Function** (using a response ID from your CSV data):
```sql
SELECT accept_pet_care_response('4421957a-334f-4e16-9b5f-c614902eab32');
```

## Current Data Status

Based on the CSV files:
- **Request ID**: `42998ea6-a1d5-4db2-ad62-6a8f4dfe4670`
- **Response ID**: `4421957a-334f-4e16-9b5f-c614902eab32`
- **Requester**: `1f66fb72-ccfb-4a55-8738-716a12543421`
- **Responder**: `2a7f3ce2-69f8-4241-831f-5c3f38f35890`
- **Response Status**: `pending` (needs to be changed to 'submitted' before acceptance)

### Fix Current Response Status

Before you can accept the response, you need to update its status to 'submitted':

```sql
UPDATE pet_care_responses
SET
    status = 'submitted',
    response_type = 'pending',
    updated_at = NOW()
WHERE id = '4421957a-334f-4e16-9b5f-c614902eab32';
```

Then you can accept it:

```sql
SELECT accept_pet_care_response('4421957a-334f-4e16-9b5f-c614902eab32');
```

## Expected Results After Fix

1. **No more 404 errors** when loading Dashboard, Chat, Calendar, or Scheduler pages
2. **Messages disappear** after submitting responses:
   - Responder submits → request disappears from their view
   - Requester accepts → response disappears from their view
3. **Correct visibility**:
   - Responder ONLY sees pending requests (before submission)
   - Requester ONLY sees submitted responses (to accept/decline)
   - Responder does NOT see requests after submission
   - Requester does NOT see their own requests
4. **Notifications are created** when responses are accepted or declined
5. **Scheduled pet care blocks are created** on acceptance with proper status

## Console Error Resolution

After deployment, these errors should be resolved:
- ✅ `POST .../rpc/get_reciprocal_pet_care_requests 404 (Not Found)`
- ✅ `POST .../rpc/get_reciprocal_pet_care_responses 404 (Not Found)`
- ✅ `Failed to accept reciprocal care response: Care response not found or not in submitted status`

## Rollback Plan

If issues occur, you can rollback by running:

```sql
DROP FUNCTION IF EXISTS get_reciprocal_pet_care_requests(UUID);
DROP FUNCTION IF EXISTS get_reciprocal_pet_care_responses(UUID);
-- Then restore the original accept_pet_care_response from migrations/20250123000002_add_pet_care_functions.sql
```

## Notes

- The pet care workflow now matches the child care workflow exactly
- Both workflows use the same notification types ('care_accepted' and 'care_declined')
- The frontend should work with these functions without any code changes
- Make sure the `notifications` table has the proper columns as defined in earlier migrations
