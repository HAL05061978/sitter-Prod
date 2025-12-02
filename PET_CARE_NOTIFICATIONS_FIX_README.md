# Pet Care Notifications Fix

## Problem Identified

**Root Cause:** The `send_pet_care_request` function creates pet care requests and responses in the database, but **does NOT create notification records**. The Messages UI relies on notifications to display pending requests, which is why pet care requests weren't showing up even though the data existed.

## Evidence

1. ✅ Pet care requests exist in database (pet_care_requests table)
2. ✅ Pet care responses exist in database (pet_care_responses table)
3. ✅ Functions `get_reciprocal_pet_care_requests` and `get_reciprocal_pet_care_responses` work correctly
4. ✅ No 404 errors after fixing Header.tsx parameter names
5. ❌ **No notification records** for pet care requests
6. ❌ UI doesn't display requests without notifications

## The Fix

Updated `send_pet_care_request` function to create a notification record when a pet care request is created:

```sql
INSERT INTO notifications (
    user_id,
    type,
    title,
    message,
    data,
    read
) VALUES (
    p_responder_id,
    'pet_care_request_received',
    'New Pet Care Request',
    'You have a new pet care request',
    jsonb_build_object(
        'request_id', v_request_id,
        'response_id', v_response_id,
        'requester_id', p_requester_id,
        'requested_date', p_requested_date,
        'reciprocal_date', p_reciprocal_date
    ),
    false
);
```

## Deployment Steps

### Option 1: Using Supabase SQL Editor (Recommended)

1. Go to Supabase Dashboard → SQL Editor
2. Open `DEPLOY_PET_CARE_NOTIFICATIONS_FIX.sql`
3. Copy the entire contents
4. Paste into Supabase SQL Editor
5. Click "Run"
6. Verify you see: "✅ Updated send_pet_care_request function to create notifications"

### Option 2: Using Supabase CLI

```bash
# If you have Supabase CLI installed
supabase db push --file DEPLOY_PET_CARE_NOTIFICATIONS_FIX.sql
```

### Option 3: Windows Batch Script

```cmd
deploy-pet-notifications.bat
```

## Testing After Deployment

### Test 1: Create New Pet Care Request

1. Login as User A
2. Go to Scheduler page
3. Create a new pet care request for User B
4. Logout

### Test 2: Verify Notification Created

1. Login as User B (the responder)
2. Go to Scheduler → Messages
3. ✅ You should now see the pet care request in the list
4. ✅ Messages button counter should increment

### Test 3: Complete Workflow

1. As User B, click on the request to respond
2. Fill in reciprocal care details
3. Submit response
4. ✅ Request should disappear from User B's view
5. Logout and login as User A
6. ✅ Response should appear for User A to accept

## What About Existing Requests?

**Important:** This fix only affects **NEW** pet care requests created AFTER deploying the function update.

### Option A: Delete Existing Test Requests

```sql
-- Run this in Supabase SQL Editor to clean up test data
DELETE FROM pet_care_responses WHERE request_id IN (
    SELECT id FROM pet_care_requests
    WHERE created_at > '2025-11-07'  -- Adjust date as needed
);

DELETE FROM pet_care_requests WHERE created_at > '2025-11-07';
```

### Option B: Manually Create Notifications for Existing Requests

```sql
-- Create notifications for existing pending pet care requests
INSERT INTO notifications (user_id, type, title, message, data, read)
SELECT
    pcr.responder_id as user_id,
    'pet_care_request_received' as type,
    'New Pet Care Request' as title,
    'You have a new pet care request' as message,
    jsonb_build_object(
        'request_id', pcr.id,
        'response_id', pcresp.id,
        'requester_id', pcr.requester_id,
        'requested_date', pcr.requested_date,
        'reciprocal_date', pcr.reciprocal_date
    ) as data,
    false as read
FROM pet_care_requests pcr
JOIN pet_care_responses pcresp ON pcresp.request_id = pcr.id
WHERE pcr.status = 'pending'
AND pcresp.status = 'pending'
AND NOT EXISTS (
    SELECT 1 FROM notifications n
    WHERE n.data->>'request_id' = pcr.id::text
    AND n.type = 'pet_care_request_received'
);
```

## Expected Results

✅ Pet care requests appear in Messages UI
✅ Message counter increments for new requests
✅ Responders can see and respond to requests
✅ After response submission, request disappears
✅ Requester sees submitted response to accept
✅ Complete workflow functions end-to-end

## Files Changed

- `DEPLOY_PET_CARE_NOTIFICATIONS_FIX.sql` - Updated function definition
- `deploy-pet-notifications.bat` - Deployment script
- `PET_CARE_NOTIFICATIONS_FIX_README.md` - This file

## Summary

**Issue:** Pet care requests not appearing in UI
**Root Cause:** Missing notification records
**Fix:** Updated send_pet_care_request to create notifications
**Status:** Ready to deploy
**Impact:** Fixes pet care request visibility in Messages

---

**Next Step:** Deploy the SQL fix to Supabase!
