# Deploy Pet Care Functions Fix

## Issues
Multiple missing pet care functions causing errors:

1. **create_pet_care_request**:
   - Error: `new row for relation "notifications" violates check constraint "notifications_type_check"`
   - Error: `column "status" of relation "notifications" does not exist`
   - **Group members not seeing pet care requests** (request_type mismatch)

2. **get_pet_care_responses_for_requester**:
   - Console error on every page: `DATABASE ERROR {operation: 'get_pet_care_responses_for_requester'...}`
   - Prevents notification counter from working correctly

Root causes:
- Missing database functions
- Schema incompatibility in notifications table
- **Request type mismatch**: created as 'open' but retrieval function only fetches 'reciprocal'

## Solution
Created **two missing functions**:

### 1. create_pet_care_request
- Creates pet care requests similar to child care requests
- Creates pending responses for all group members
- **Creates notifications with the correct type** ('care_request' instead of invalid types)
- **Compatible with both notification table schemas** (uses default value for is_read/status)

### 2. get_pet_care_responses_for_requester
- Retrieves pet care responses to requests made by the user
- Used by Header.tsx for notification counter
- Mirrors the child care `get_responses_for_requester` function

## Deployment Steps

### Step 1: Open Supabase Dashboard
1. Go to https://supabase.com/dashboard
2. Select your project: **hilkelodfneancwwzvoh**
3. Navigate to **SQL Editor** (left sidebar)

### Step 2: Run Migration 1 - create_pet_care_request
1. Click "New query"
2. Copy the contents of the file:
   ```
   migrations/20250115000025_create_pet_care_request_function.sql
   ```
3. Paste into the SQL Editor
4. Click "Run" button
5. Wait for success confirmation

### Step 3: Run Migration 2 - get_pet_care_responses_for_requester
1. Click "New query" again
2. Copy the contents of the file:
   ```
   migrations/20250115000026_add_get_pet_care_responses_for_requester.sql
   ```
3. Paste into the SQL Editor
4. Click "Run" button
5. Wait for success confirmation

### Step 4: Verify Deployment
Run this query to verify both functions were created:
```sql
SELECT routine_name, routine_type, data_type as return_type
FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_name IN ('create_pet_care_request', 'get_pet_care_responses_for_requester')
ORDER BY routine_name;
```

You should see **2 rows**:
1. routine_name: `create_pet_care_request`, routine_type: `FUNCTION`, return_type: `uuid`
2. routine_name: `get_pet_care_responses_for_requester`, routine_type: `FUNCTION`, return_type: `TABLE`

### Step 5: Test the Fix
1. **Refresh your application** (hard refresh: Cmd+Shift+R on Mac, Ctrl+Shift+R on Windows)
2. **Check console errors are gone**: Open browser console and verify no more `get_pet_care_responses_for_requester` errors
3. **Test creating a Pet Care request**:
   - Go to Calendar page
   - Create a new Pet Care request
   - Should succeed without errors
4. **Verify notifications**:
   - Check that group members receive notifications
   - Check notification counter updates correctly

## What Changed

### Function 1: create_pet_care_request
**Parameters:**
- requester_id (UUID)
- group_id (UUID)
- requested_date (DATE)
- start_time (TIME)
- end_time (TIME)
- pet_id (UUID)
- end_date (DATE, optional - for multi-day care)
- notes (TEXT, optional)

**What it does:**
- Creates pet care request in `pet_care_requests` table with **request_type = 'reciprocal'** (CRITICAL: matches the retrieval function)
- Creates pending responses for all active group members
- Creates notifications using **'care_request'** type (valid type from notifications table constraint)
- Compatible with both notification table schemas (is_read vs status)
- Ensures requests are visible to group members via `get_reciprocal_pet_care_requests`

### Function 2: get_pet_care_responses_for_requester
**Parameters:**
- p_requester_id (UUID)

**What it does:**
- Returns all pet care responses to requests made by the user
- Used by Header.tsx for counting pending responses
- Includes pet names, responder names, dates, and status
- Filters by request owner to show only relevant responses

## Valid Notification Types
For reference, the valid notification types are:
- 'group_invite'
- 'care_request' ✅ (used in this fix)
- 'care_response'
- 'reschedule'
- 'message'
- 'system'

## Troubleshooting
If you still get errors:
1. Check console for specific error messages
2. Verify the function exists with the query in Step 3
3. Check that all required parameters are being passed from the frontend
4. Verify group membership is active

## Files Created
1. `migrations/20250115000025_create_pet_care_request_function.sql` - Creates pet care request function
2. `migrations/20250115000026_add_get_pet_care_responses_for_requester.sql` - Gets responses for requester
3. `DEPLOY_CREATE_PET_CARE_REQUEST_FIX.md` - This deployment guide

## Quick Deploy Summary
Run **both** SQL files in your Supabase SQL Editor in order:
1. First: `20250115000025_create_pet_care_request_function.sql`
2. Second: `20250115000026_add_get_pet_care_responses_for_requester.sql`

This will fix:
- ✅ Pet care request creation errors
- ✅ Console errors on every page
- ✅ Notification counter not updating
- ✅ Group members not receiving notifications
- ✅ **Group members not seeing pet care requests in their list** (request_type mismatch fixed)

## CRITICAL FIX - Request Visibility
The most important fix in this update: Pet care requests are now created with `request_type = 'reciprocal'` instead of `'open'`. This ensures they appear in the `get_reciprocal_pet_care_requests` function that displays requests to group members. Without this fix, requests would be created but invisible to potential responders!
