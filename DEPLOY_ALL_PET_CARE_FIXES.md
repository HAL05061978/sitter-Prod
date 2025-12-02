# Deploy All Pet Care Function Fixes

## Complete Fix for Pet Care Workflow

This deployment fixes ALL pet care issues found during testing.

## 🚨 COUNTER NOT UPDATING? READ THIS FIRST

If your **messages/scheduler counter is not ticking up** when you receive pet care responses:

1. **Re-deploy Migration #2** (even if you deployed it before):
   - File: `migrations/20250115000026_add_get_pet_care_responses_for_requester.sql`
   - This file has been updated multiple times with filter fixes

2. **Hard refresh your browser**:
   - Mac: Cmd+Shift+R
   - Windows: Ctrl+Shift+R

3. **Test**:
   - Have a group member submit a response to your pet care request
   - Counter should increment

4. **Still not working?**:
   - See `DIAGNOSE_PET_CARE_COUNTER.md` for detailed troubleshooting

## Issues Fixed

### 1. create_pet_care_request
- ❌ Invalid notification type causing constraint violation
- ❌ Schema incompatibility (status vs is_read)
- ❌ Request type mismatch (created as 'open', needs 'reciprocal')
- ✅ **FIXED**: All issues resolved

### 2. get_pet_care_responses_for_requester (TYPE MISMATCH FIX)
- ❌ Function missing, causing console errors on every page
- ❌ **Type mismatch error**: VARCHAR(50) vs TEXT causing function to fail
- ❌ Missing filters: response_type and request_type
- ❌ Message counter not updating when responses submitted
- ✅ **FIXED**: Type cast added (status::TEXT)
- ✅ **FIXED**: Function created with correct filters

### 3. submit_pet_care_response
- ❌ Invalid notification type 'pet_care_response_submitted'
- ❌ Schema incompatibility (is_read)
- ✅ **FIXED**: Now uses 'care_response' type

### 4. accept_pet_care_response (UPDATED)
- ❌ Schema incompatibility (is_read)
- ❌ **Not updating pet_care_requests with reciprocal details**
- ❌ **Missing end_date on reciprocal blocks (breaks multi-day care)**
- ❌ **Calendar counter not updating for responding owner (needs 'care_accepted' type)**
- ✅ **FIXED**: Uses 'care_accepted' for accepted responder (required for calendar counter)
- ✅ **FIXED**: Uses 'care_declined' for declined responders
- ✅ **FIXED**: Updates pet_care_requests with reciprocal data
- ✅ **FIXED**: Adds end_date to all blocks for multi-day support
- ✅ **FIXED**: Calendar counter now updates with blocks_created: 2

## Symptoms Before Fix

1. Creating pet care request: "notifications violates check constraint"
2. Every page load: Console error about get_pet_care_responses_for_requester
3. Responding to pet care request: "notifications violates check constraint"
4. Group members not seeing pet care requests
5. Notification counter not working
6. **Message counter not updating when group members respond to pet care requests**
7. **Calendar counter not updating for responding owner when their response is accepted**
8. **pet_care_requests table not storing accepted reciprocal details (dates/times all NULL)**
9. **Multi-day reciprocal blocks only creating for first day (missing end_date)**

## Deployment Steps

### Step 1: Open Supabase Dashboard
1. Go to https://supabase.com/dashboard
2. Select your project: **hilkelodfneancwwzvoh**
3. Navigate to **SQL Editor** (left sidebar)

### Step 2: Run All Migrations in Order

Run each migration in a **separate query** in the order below:

#### Migration 1: create_pet_care_request
```
File: migrations/20250115000025_create_pet_care_request_function.sql
```
1. Click "New query"
2. Copy entire file contents
3. Paste and click "Run"
4. Wait for success ✅

#### Migration 2: get_pet_care_responses_for_requester (CRITICAL - TYPE MISMATCH FIX)
```
File: migrations/20250115000026_add_get_pet_care_responses_for_requester.sql
```
**🚨 CRITICAL**: This file has been updated to fix **TYPE MISMATCH ERROR**. **YOU MUST RE-DEPLOY** even if you deployed it before.

**ERROR FIXED**: `structure of query does not match function result type... VARCHAR(50) does not match TEXT`

1. Click "New query"
2. Copy entire file contents (latest version with type cast)
3. Paste and click "Run"
4. Wait for success ✅
5. **Hard refresh your app** after deploying (Cmd+Shift+R)

**What changed**:
- **FIXED: Added `::TEXT` cast to ALL VARCHAR columns** (names, notes, status)
  - group_name, requester_name, notes, status, response_notes, responder_name
  - **pet_name** (this was the column 21 error)
  - reciprocal_pet_name
- Added filters for `response_type = 'pending'`
- Added filter for `request_type = 'reciprocal'`
- Added filter for `status IN ('submitted', 'accepted', 'declined')`

**What this fixes**:
- ✅ **Function error: type mismatch VARCHAR(255) vs TEXT in column 21 (pet_name)**
- ✅ **Function error: type mismatch for all VARCHAR columns**
- ✅ Console errors on every page
- ✅ **Message/scheduler counter not updating when you receive pet care responses**

**Test after deploying**:
```sql
SELECT * FROM get_pet_care_responses_for_requester('YOUR_USER_ID');
```
Should return your submitted pet care responses without error.

**If counter still doesn't work**: See `DIAGNOSE_PET_CARE_COUNTER.md` for troubleshooting steps.

#### Migration 3: submit_pet_care_response
```
File: migrations/20250115000027_fix_submit_pet_care_response_notifications.sql
```
1. Click "New query"
2. Copy entire file contents
3. Paste and click "Run"
4. Wait for success ✅

#### Migration 4: accept_pet_care_response (UPDATED - CALENDAR COUNTER FIX)
```
File: migrations/20250115000028_fix_accept_pet_care_response_notifications.sql
```
**⚠️ IMPORTANT**: This file has been updated to fix calendar counter. If you already deployed it earlier, **re-deploy it now** with the updated version.

1. Click "New query"
2. Copy entire file contents (updated version)
3. Paste and click "Run"
4. Wait for success ✅

**What changed**:
- **FIXED: Uses 'care_accepted' notification type** (required for calendar counter)
- Uses 'care_declined' for declined responses
- Added `end_date` field to reciprocal scheduled_pet_care blocks (fixes multi-day)
- Updates `pet_care_requests` table with reciprocal details from accepted response
- Includes `blocks_created: 2` in notification data for calendar counter

**What this fixes**:
- ✅ **Calendar counter updates for responding owner when their response is accepted**
- ✅ Responder sees "+2" on calendar button for their 2 new blocks
- ✅ Multi-day reciprocal care works correctly
- ✅ pet_care_requests stores reciprocal details

### Step 3: Verify All Functions
Run this verification query:
```sql
SELECT routine_name, routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_name IN (
    'create_pet_care_request',
    'get_pet_care_responses_for_requester',
    'submit_pet_care_response',
    'accept_pet_care_response'
)
ORDER BY routine_name;
```

You should see **4 functions**:
1. accept_pet_care_response
2. create_pet_care_request
3. get_pet_care_responses_for_requester
4. submit_pet_care_response

### Step 4: Test the Complete Workflow

1. **Hard refresh your app** (Cmd+Shift+R on Mac, Ctrl+Shift+R on Windows)

2. **Create a pet care request**:
   - Go to Calendar page
   - Create new pet care request
   - Should succeed without errors ✅

3. **Verify group members see it**:
   - Log in as a group member
   - Go to Scheduler page
   - Request should appear in "Requests Needing Response" ✅

4. **Respond to the request**:
   - Group member proposes reciprocal dates
   - Submit response
   - Should succeed without errors ✅

5. **Accept the response**:
   - Log back in as requester
   - Go to Scheduler page
   - Accept the response
   - Should succeed without errors ✅
   - Calendar blocks should be created ✅

6. **Verify notifications**:
   - Notification counter should update
   - No console errors
   - All participants receive appropriate notifications ✅

## What Was Fixed

### Notification Types
All functions now use **valid notification types**:
- 'care_request' - for new requests
- 'care_response' - for responses (submitted, accepted, declined)

### Schema Compatibility
All functions work with both notification schemas:
- Old schema: `is_read BOOLEAN`
- New schema: `status TEXT`

Functions don't specify is_read/status, using default values instead.

### Request Visibility
Pet care requests now created with:
- `request_type = 'reciprocal'` (matches retrieval function)
- `is_reciprocal = true`

This ensures requests appear in `get_reciprocal_pet_care_requests`.

### Message Counter Fix
The `get_pet_care_responses_for_requester` function now filters correctly:
- `response_type = 'pending'` - Only count responses awaiting action
- `status IN ('submitted', 'accepted', 'declined')` - Exclude placeholder responses
- `request_type = 'reciprocal'` - Only reciprocal requests

This matches the child care pattern and ensures the message counter updates when group members respond to pet care requests.

### Multi-Day Pet Care Support
The `accept_pet_care_response` function now:
1. **Adds end_date to reciprocal blocks**: Both reciprocal scheduled_pet_care records now include `end_date` from the response's `reciprocal_end_date` field
2. **Updates pet_care_requests table**: Stores all reciprocal details when accepting:
   - `reciprocal_pet_id`
   - `reciprocal_date`
   - `reciprocal_start_time`
   - `reciprocal_end_time`
   - `reciprocal_end_date` (for multi-day)

**Before**: Multi-day reciprocal requests only created blocks for the first day
**After**: Full multi-day reciprocal blocks are created with proper start and end dates

## Files Created/Modified

1. `migrations/20250115000025_create_pet_care_request_function.sql` - Creates requests with notifications
2. `migrations/20250115000026_add_get_pet_care_responses_for_requester.sql` - Gets responses for counter
3. `migrations/20250115000027_fix_submit_pet_care_response_notifications.sql` - Submit with correct notifications
4. `migrations/20250115000028_fix_accept_pet_care_response_notifications.sql` - Accept with correct notifications
5. `DEPLOY_ALL_PET_CARE_FIXES.md` - This deployment guide

## Quick Summary

Run 4 SQL files in Supabase SQL Editor in this order:
1. `20250115000025_create_pet_care_request_function.sql`
2. `20250115000026_add_get_pet_care_responses_for_requester.sql`
3. `20250115000027_fix_submit_pet_care_response_notifications.sql`
4. `20250115000028_fix_accept_pet_care_response_notifications.sql`

This will fix:
- ✅ Pet care request creation
- ✅ Request visibility for group members
- ✅ Response submission
- ✅ Response acceptance
- ✅ All notifications
- ✅ Console errors
- ✅ Notification counter
- ✅ **Message counter updates when responses are submitted**
- ✅ **Calendar counter updates when responses are accepted (responder sees +2 blocks)**
- ✅ **Multi-day reciprocal pet care blocks (end_date added)**
- ✅ **pet_care_requests table stores reciprocal details**
- ✅ Complete pet care workflow

## Valid Notification Types Reference

For future reference, valid notification types in your database:
- `'care_request'` - Used for new care requests
- `'care_response'` - Used for response submissions
- `'care_accepted'` - **REQUIRED for calendar counter** (when response is accepted)
- `'care_declined'` - Used when responses are declined
- `'group_invitation'`
- `'event_invitation'`
- `'open_block_invitation'`
- `'open_block_accepted'`
- `'reschedule_request'`
- `'reschedule_accepted'`
- `'reschedule_declined'`
- `'reschedule_counter_sent'`
- `'reschedule_counter_accepted'`
- `'reschedule_counter_declined'`
- `'hangout_accepted'`

Never use types like:
- ❌ 'pet_care_response_submitted'
- ❌ 'reschedule_response'
- ❌ 'reschedule'
- ❌ 'message'
- ❌ 'system'

These will cause constraint violations!
