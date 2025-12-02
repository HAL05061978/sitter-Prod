# CRITICAL FIX: Accepted/Declined Messages Not Appearing

## Problem
When a reciprocal care response was accepted or declined, the responding parent never saw a message about it in their inbox.

## Root Cause
The `get_my_submitted_responses` function was only returning responses with `status = 'submitted'`.

When a response is accepted or declined:
1. The `accept_reciprocal_care_response` function updates the response status to `'accepted'` or `'declined'`
2. The `get_my_submitted_responses` function runs
3. It filters for `status = 'submitted'` only
4. The accepted/declined responses are excluded from results
5. No message appears in the responder's inbox

## The Fix

### File: `migrations/20250128_fix_get_my_submitted_responses.sql`

**Before:**
```sql
WHERE cr.responder_id = parent_id
AND cr.response_type = 'pending'
AND cr.status = 'submitted'  -- Only returns submitted responses!
```

**After:**
```sql
WHERE cr.responder_id = parent_id
AND cr.response_type = 'pending'
AND cr.status IN ('submitted', 'pending', 'accepted', 'declined')  -- Returns all statuses
```

## Impact

### Before Fix:
- ❌ Responders never saw when their response was accepted
- ❌ Responders never saw when their response was declined
- ❌ Messages only appeared while status was 'submitted'
- ❌ Once status changed, message disappeared

### After Fix:
- ✅ Responders see message: "Your reciprocal response for [date] has been accepted"
- ✅ Responders see message: "Your reciprocal response for [date] was not accepted"
- ✅ Messages remain visible with appropriate status badges
- ✅ Expanded view shows all care block details

## Deployment

**CRITICAL: This migration must be deployed BEFORE the notification migration**

### Order of Deployment:
1. **First:** Deploy `migrations/20250128_fix_get_my_submitted_responses.sql`
2. **Then:** Deploy `migrations/20250128_add_reciprocal_response_notifications.sql`

### Via Supabase Dashboard:
```sql
-- Run this first in SQL Editor
DROP FUNCTION IF EXISTS get_my_submitted_responses(UUID);

CREATE OR REPLACE FUNCTION get_my_submitted_responses(parent_id UUID)
RETURNS TABLE (
    -- ... table definition ...
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT
        -- ... fields ...
    FROM care_responses cr
    JOIN care_requests cq ON cr.request_id = cq.id
    JOIN groups g ON cq.group_id = g.id
    JOIN profiles p ON cq.requester_id = p.id
    WHERE cr.responder_id = parent_id
    AND cr.response_type = 'pending'
    AND cr.status IN ('submitted', 'pending', 'accepted', 'declined')  -- KEY FIX
    -- ... rest of conditions ...
END;
$$;
```

## Testing

1. **Create test scenario:**
   - User A creates reciprocal care request
   - User B responds with reciprocal care offer
   - User A accepts User B's response

2. **Verify User B sees message:**
   - Message appears in scheduler inbox
   - Title: "Your reciprocal response for [date] ([time]) has been accepted. Care blocks have been added to your calendar"
   - Badge: Green "Accepted"
   - Expansion shows both care blocks

3. **Test decline scenario:**
   - User A creates reciprocal care request
   - User B and User C respond
   - User A accepts User B's response

4. **Verify User C sees message:**
   - Message appears in scheduler inbox
   - Title: "Your reciprocal response for [date] was not accepted"
   - Badge: Red "Not Accepted"
   - Expansion shows explanation and details

## Related Files
- Frontend: `app/scheduler/page.tsx` (lines 704-717)
- Backend: `supabase/supabase/migrations/20250115000002_add_missing_response_functions.sql` (updated)
- New Migration: `migrations/20250128_fix_get_my_submitted_responses.sql`
