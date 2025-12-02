# Pet Care Frontend Issues - Analysis and Solutions

## Issues Identified

Based on your description and the console errors, there are several frontend/backend integration issues:

### Issue 1: Request Visibility
**Problem**: Both the requester and responder can see the request in their messages.

**Expected Behavior**:
- **Requester** should ONLY see responses to their request (to accept/decline)
- **Responder** should ONLY see requests they need to respond to (before submitting)

**Root Cause**: The frontend is fetching both:
1. `get_reciprocal_pet_care_requests()` - Returns requests I need to respond to
2. `get_reciprocal_pet_care_responses()` - Returns responses to MY requests

The issue is that the frontend may not be filtering properly or the database query includes the requester when it shouldn't.

**Solution**: Update the query functions to ensure proper filtering:

```sql
-- In get_reciprocal_pet_care_requests: Already correct with this line
WHERE pcr.responder_id = p_parent_id
AND pcrq.requester_id != p_parent_id  -- Don't show responses to own requests

-- In get_reciprocal_pet_care_responses: Already correct with this line
WHERE pcrq.requester_id = p_parent_id  -- Only show responses to MY requests
```

### Issue 2: Message Not Disappearing After Submission
**Problem**: When the responder submits their reciprocal response, the message doesn't disappear from their view.

**Expected Behavior**:
- After submitting a response (status changes from 'pending' to 'submitted'), the request should disappear from the responder's list
- The request should now appear ONLY for the requester to accept

**Root Cause**: The `get_reciprocal_pet_care_requests` function includes BOTH 'pending' AND 'submitted' status:

```sql
AND cr.status IN ('pending', 'submitted')  -- This is the issue!
```

**Solution**: Change the query to ONLY show pending requests:

```sql
-- For responders: Only show requests they haven't responded to yet
AND pcr.status = 'pending'  -- Remove 'submitted' from this list

-- For requesters: Show submitted responses they need to review
AND pcr.status IN ('submitted', 'accepted', 'declined')
```

### Issue 3: Response Appearing for Responder After Submission
**Problem**: After the responder submits their response, they can see it (incorrectly showing both the request AND response).

**Expected Behavior**:
- Responder should NOT see their own submitted response
- Only the requester should see submitted responses (to accept/decline)

**Root Cause**: The responder is seeing data from `get_reciprocal_pet_care_responses()` which should only return data for the requester.

**Solution**: The query is already correct, but verify the frontend is not displaying responses to the wrong user.

### Issue 4: Accept Response Error
**Problem**: Error "Care response not found or not in submitted status"

**Root Cause**: The response status is 'pending' but the function expects 'submitted'.

**Solution**: The `submit_pet_care_response` function should change the status from 'pending' to 'submitted'. This is already implemented in the migration fix.

## Required Fixes

### Database Fix 1: Update get_reciprocal_pet_care_requests

The function should ONLY return pending requests (not submitted ones):

```sql
CREATE OR REPLACE FUNCTION get_reciprocal_pet_care_requests(
    p_parent_id UUID
)
RETURNS TABLE (...)
AS $$
BEGIN
    RETURN QUERY
    SELECT ...
    FROM pet_care_responses pcr
    ...
    WHERE pcr.responder_id = p_parent_id
    AND pcr.status = 'pending'  -- CHANGED: Only pending, not submitted
    AND pcrq.request_type = 'reciprocal'
    AND pcrq.requester_id != p_parent_id
    ORDER BY pcr.created_at DESC;
END;
$$;
```

### Database Fix 2: Verify submit_pet_care_response Updates Status

The `submit_pet_care_response` function must change status from 'pending' to 'submitted':

```sql
UPDATE pet_care_responses SET
    ...
    status = 'submitted',  -- This must be set!
    ...
WHERE id = existing_response_id;
```

This is already in the migration `20250123000002_add_pet_care_functions.sql` at line 217.

### Frontend Verification

The frontend in `app/scheduler/page.tsx` should:

1. **Display Requests** (lines 1792-1826):
   - Show requests where `user.id` is the RESPONDER
   - Only show status = 'pending'
   - Hide after user submits response

2. **Display Responses** (lines 1875-1883, 1885-1930):
   - Show responses where `user.id` is the REQUESTER
   - Only show status = 'submitted' (for acceptance)
   - Show status = 'accepted'/'declined' (for history)

## Testing Steps

### Test 1: Verify Requester Doesn't See Their Own Request

1. Login as requester (ID: `1f66fb72-ccfb-4a55-8738-716a12543421`)
2. Navigate to Scheduler/Messages
3. **Expected**: Should NOT see the request they created
4. **Expected**: Should see responses from responder (after submission)

### Test 2: Verify Responder Sees Request Until Submission

1. Login as responder (ID: `2a7f3ce2-69f8-4241-831f-5c3f38f35890`)
2. Navigate to Scheduler/Messages
3. **Expected**: Should see the request with status 'pending'
4. Submit response with reciprocal details
5. **Expected**: Request disappears from their view
6. **Expected**: Should NOT see it in any list

### Test 3: Verify Requester Can Accept Response

1. Login as requester
2. Navigate to Scheduler/Messages
3. **Expected**: Should see the submitted response
4. Click "Accept"
5. **Expected**: Success message
6. **Expected**: Response disappears
7. **Expected**: Calendar updated with 4 blocks

### Test 4: Verify Notifications Are Created

After acceptance:
1. Responder should receive 'care_accepted' notification
2. Other responders (if any) should receive 'care_declined' notification
3. Verify in notifications table:

```sql
SELECT * FROM notifications
WHERE user_id IN ('requester_id', 'responder_id')
AND type IN ('care_accepted', 'care_declined')
ORDER BY created_at DESC;
```

## Quick Fix SQL

Run this to update the query function:

```sql
-- Fix get_reciprocal_pet_care_requests to only show pending
CREATE OR REPLACE FUNCTION get_reciprocal_pet_care_requests(
    p_parent_id UUID
)
RETURNS TABLE (
    care_response_id UUID,
    care_request_id UUID,
    group_id UUID,
    group_name TEXT,
    requester_id UUID,
    requester_name TEXT,
    requested_date DATE,
    requested_end_date DATE,
    start_time TIME,
    end_time TIME,
    notes TEXT,
    status TEXT,
    created_at TIMESTAMPTZ,
    response_count INTEGER,
    accepted_response_count INTEGER,
    pet_id UUID,
    pet_name TEXT,
    reciprocal_pet_id UUID,
    reciprocal_pet_name TEXT,
    reciprocal_date DATE,
    reciprocal_start_time TIME,
    reciprocal_end_time TIME
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT
        pcr.id as care_response_id,
        pcrq.id as care_request_id,
        pcrq.group_id,
        g.name as group_name,
        pcrq.requester_id,
        p.full_name as requester_name,
        pcrq.requested_date,
        pcrq.end_date as requested_end_date,
        pcrq.start_time,
        pcrq.end_time,
        pcrq.notes,
        pcr.status,
        pcr.created_at,
        COALESCE(response_counts.response_count, 0)::INTEGER as response_count,
        COALESCE(response_counts.accepted_response_count, 0)::INTEGER as accepted_response_count,
        pcrq.pet_id,
        pet.name as pet_name,
        pcrq.reciprocal_pet_id,
        rpet.name as reciprocal_pet_name,
        pcrq.reciprocal_date,
        pcrq.reciprocal_start_time,
        pcrq.reciprocal_end_time
    FROM pet_care_responses pcr
    JOIN pet_care_requests pcrq ON pcr.request_id = pcrq.id
    JOIN groups g ON pcrq.group_id = g.id
    JOIN profiles p ON pcrq.requester_id = p.id
    LEFT JOIN pets pet ON pcrq.pet_id = pet.id
    LEFT JOIN pets rpet ON pcrq.reciprocal_pet_id = rpet.id
    LEFT JOIN (
        SELECT
            request_id,
            COUNT(*)::INTEGER as response_count,
            COUNT(*) FILTER (WHERE status = 'accepted')::INTEGER as accepted_response_count
        FROM pet_care_responses
        GROUP BY request_id
    ) response_counts ON pcrq.id = response_counts.request_id
    WHERE pcr.responder_id = p_parent_id
    AND pcr.status = 'pending'  -- FIXED: Only pending, not submitted!
    AND pcrq.request_type = 'reciprocal'
    AND pcrq.requester_id != p_parent_id
    ORDER BY pcr.created_at DESC;
END;
$$;
```

## Summary

The main issue is that `get_reciprocal_pet_care_requests` includes both 'pending' AND 'submitted' status. This causes:
1. Responders to see requests even after they've submitted
2. Messages not disappearing after submission
3. Confusion about who should see what

**Fix**: Change the status filter to ONLY 'pending' in `get_reciprocal_pet_care_requests`.
