# Counter-Proposal Not Creating Request for Original Requester

## Problem Summary

### Issue 1: Hugo Not Receiving Reschedule (FALSE ALARM)
**Status**: ✅ **NOT A BUG** - Database shows Hugo HAS a pending care_response

From `care_responses.csv` row 11:
```
id: d28e7148
request_id: 31393b6c (Rosmary's reschedule)
responder_id: 2a7f3ce2 (Hugo)
status: pending
action_type: reschedule_response
```

Hugo DID receive the reschedule notification. This is likely a **UI issue** - check notifications panel.

### Issue 2: Counter-Proposal Not Reaching Rosmary (REAL BUG)
**Status**: ❌ **CONFIRMED BUG** - No counter-proposal request created

When Bruce declined and sent counter-proposal:
- ✅ Bruce's care_response updated with counter_proposal_date/time
- ❌ **NO new care_request created for Rosmary to respond to**
- ❌ Rosmary has no notification to accept/decline Bruce's counter

## Root Cause

The deployed `handle_improved_reschedule_response` function (migration 20251024120200) is **INCOMPLETE**.

It handles:
- ✅ Accepting reschedule
- ✅ Accepting counter-proposal
- ❌ **MISSING**: Declining with counter-proposal

The complete logic exists in `COMPLETE_FIX_reschedule_workflow.sql` but was **never fully deployed** to migrations!

## What Should Happen

When Bruce declines with counter-proposal (lines 643-688 in COMPLETE_FIX):

1. **Create new care_request** for counter-proposal:
   ```sql
   INSERT INTO care_requests (
       ...
       requester_id: Bruce (counter-proposer)
       requested_date: 2025-10-30 (counter time)
       start_time: 18:00:00
       end_time: 22:00:00
       request_type: 'reschedule'
       action_type: 'reschedule_counter'
       counter_proposal_to: original_reschedule_id
       ...
   )
   ```

2. **Create care_response for Rosmary**:
   ```sql
   INSERT INTO care_responses (
       request_id: counter_proposal_id,
       responder_id: Rosmary,
       status: 'pending',
       action_type: 'counter_proposal_response'
   )
   ```

3. **Remove Bruce's child from yellow block** (he's declining)
4. **Keep yellow blocks active** for other parents (Hugo, Karen still pending)

## The Missing Code

The deployed migration is missing this entire section (lines 643-720 from COMPLETE_FIX):

```sql
ELSIF p_decline_action = 'counter_propose' AND p_counter_proposal_date IS NOT NULL THEN
    -- Create counter-proposal care_request
    INSERT INTO care_requests (...) VALUES (...) RETURNING id INTO v_counter_proposal_id;

    -- Create response for original requester
    INSERT INTO care_responses (...) VALUES (...);

    -- Remove declining parent's child from yellow blocks
    DELETE FROM scheduled_care_children WHERE ...;

    -- Cancel selected arrangement if provided
    IF p_selected_cancellation_request_id IS NOT NULL THEN ...
```

## Current State Analysis

### Reschedule Responses (Working ✅)

From `care_responses.csv`:
- Row 5: Bruce (1f66fb72) - status=`declined`, has counter_proposal_date/time ✅
- Row 10: Karen (1ddffe94) - status=`pending` ✅
- Row 11: **Hugo (2a7f3ce2) - status=`pending`** ✅

All three parents received the reschedule notification! If Hugo doesn't see it in UI, check:
1. Notifications panel refresh
2. care_responses query filtering
3. Real-time subscription

### Counter-Proposal (Broken ❌)

No counter-proposal request exists in `care_requests.csv`!

Expected:
```
id: <new_uuid>
requester_id: 1f66fb72 (Bruce)
requested_date: 2025-10-30
start_time: 18:00:00
end_time: 22:00:00
request_type: 'reschedule'
action_type: 'reschedule_counter'
counter_proposal_to: 31393b6c (original reschedule)
```

Actual: **MISSING**

## Solution

You need to deploy the COMPLETE `handle_improved_reschedule_response` function from `COMPLETE_FIX_reschedule_workflow.sql`.

The function is **912 lines** and includes:
- Accept reschedule logic (lines 316-541)
- **Decline with counter-proposal logic (lines 643-720)** ⭐ MISSING
- Decline with cancel logic (lines 721-800)
- Counter-proposal decline logic (lines 543-642)
- Cleanup logic

## Manual Deployment Required

The complete function is too large to paste here. You need to:

1. Open `COMPLETE_FIX_reschedule_workflow.sql`
2. Find the `handle_improved_reschedule_response` function (starts around line 193)
3. Copy the entire function definition
4. Go to Supabase SQL Editor
5. Run: `DROP FUNCTION IF EXISTS handle_improved_reschedule_response(UUID, UUID, TEXT, TEXT, TEXT, DATE, TIME, TIME, UUID, TEXT);`
6. Paste the complete function
7. Execute

## Verification After Deployment

### Test Counter-Proposal

1. Rosmary reschedules a block
2. Bruce declines and sends counter-proposal for 2025-10-30 18:00-22:00
3. **Check database**:
   ```sql
   -- Should show new counter-proposal request
   SELECT * FROM care_requests
   WHERE requester_id = '1f66fb72-ccfb-4a55-8738-716a12543421'
   AND request_type = 'reschedule'
   AND requested_date = '2025-10-30';

   -- Should show Rosmary's pending response
   SELECT * FROM care_responses
   WHERE request_id = <counter_proposal_id>
   AND responder_id = '88416767-8bca-46c7-9dd3-f191a134b46b'
   AND status = 'pending';
   ```

4. **Check UI**: Rosmary should see notification to accept/decline counter

### Test Hugo Receiving Reschedule

If Hugo still doesn't see reschedule notification after confirming it's in the database:

1. Check notifications query filters
2. Check real-time subscription
3. Check UI component that displays reschedule notifications
4. Look for console errors in browser

## Files to Review

- `COMPLETE_FIX_reschedule_workflow.sql` - Has complete function
- `supabase\supabase\migrations\20251024120200_deploy_handle_improved_reschedule_response.sql` - Current (incomplete) deployment
- `components\care\RescheduleResponseModal.tsx` - Frontend component

## Summary

- ✅ **Hugo IS receiving reschedule** - check UI/notifications
- ❌ **Counter-proposal NOT creating request** - deploy complete function
- The deployed function is missing ~200 lines of decline/counter logic
- Need to deploy complete `handle_improved_reschedule_response` from COMPLETE_FIX file