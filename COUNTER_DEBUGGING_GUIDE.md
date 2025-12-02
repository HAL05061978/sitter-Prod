# Counter Debugging Guide

## Issues Identified

### 1. get_pet_care_responses_for_requester 400 Error

**Problem:** The function `get_pet_care_responses_for_requester` is being called but returns a 400 Bad Request error.

**Root Cause:** The function likely doesn't exist in your production Supabase database or there's a parameter mismatch.

**Location:**
- `app/components/Header.tsx` line 168
- Function definition in `WriteUps/Functions/get_pet_care_responses_for_requester.txt`

**Solution:** Deploy the function to your Supabase database. The function should:
```sql
CREATE OR REPLACE FUNCTION get_pet_care_responses_for_requester(p_requester_id UUID)
RETURNS TABLE (
    care_response_id UUID,
    care_request_id UUID,
    group_id UUID,
    group_name TEXT,
    requester_id UUID,
    requester_name TEXT,
    requested_date DATE,
    start_time TIME,
    end_time TIME,
    notes TEXT,
    status VARCHAR,
    created_at TIMESTAMP,
    reciprocal_date DATE,
    reciprocal_start_time TIME,
    reciprocal_end_time TIME,
    response_notes TEXT,
    responder_id UUID,
    responder_name TEXT
) LANGUAGE plpgsql AS $$
BEGIN
    RETURN QUERY
    SELECT
        pcr.id as care_response_id,
        pcr.request_id as care_request_id,
        pcrq.group_id,
        g.name as group_name,
        pcrq.requester_id,
        p.full_name as requester_name,
        pcrq.requested_date,
        pcrq.start_time,
        pcrq.end_time,
        pcrq.notes,
        pcr.status,
        pcr.created_at,
        pcr.reciprocal_date,
        pcr.reciprocal_start_time,
        pcr.reciprocal_end_time,
        pcr.response_notes,
        pcr.responder_id,
        rp.full_name as responder_name
    FROM pet_care_responses pcr
    JOIN pet_care_requests pcrq ON pcr.request_id = pcrq.id
    JOIN groups g ON pcrq.group_id = g.id
    JOIN profiles p ON pcrq.requester_id = p.id
    LEFT JOIN profiles rp ON pcr.responder_id = rp.id
    WHERE pcrq.requester_id = p_requester_id
    AND pcr.status IN ('submitted', 'accepted', 'declined')
    ORDER BY pcr.created_at DESC;
END;
$$;
```

### 2. Calendar Counter Not Updating for Requester

**Problem:** When a requester (the person who created the care request) accepts a reciprocal response, the calendar counter doesn't update properly.

**Expected Behavior:**
- When requester accepts a response, they should get a `care_accepted` notification
- This notification should trigger the calendar counter to increment
- Calendar counter in Header should show the new blocks

**Possible Root Causes:**
1. The `care_accepted` notification is not being created for the requester
2. The notification is not being fetched properly by Header
3. The event dispatch is not triggering the Header to refresh

### 3. Open Block Acceptance Counter Issue

**Problem:** When a parent accepts an open block offer, the calendar counter may not update for the offerer (parent who created the open block).

**Expected Behavior:**
- Both acceptor AND offerer should get `care_accepted` notifications
- Calendar counter should update for both parties
- Offerer should see their new blocks appear

## Using the Counter Debugger

### Setup

The Counter Debugger has been integrated into:
1. `lib/counter-debugger.ts` - Main debugger utility
2. `app/components/Header.tsx` - Counter calculation and event listeners
3. `app/scheduler/page.tsx` - Counter event dispatches

### How to Use

1. **Open your browser console** while using the app

2. **The debugger will automatically log:**
   - 🔄 Counter fetches (when Header queries for counter data)
   - 📊 Counter calculations (detailed breakdown of what's being counted)
   - 📡 Event dispatches (when events are sent)
   - 📥 Event receipts (when events are received)
   - ✅ Reciprocal acceptances
   - ✅ Open block acceptances
   - 🔔 Notifications created
   - ❌ Database errors

3. **Available Console Commands:**

```javascript
// Show all logged events
CounterDebugger.showHistory()

// Show only counter update flow
CounterDebugger.showCounterFlow()

// Show event dispatch flow
CounterDebugger.showEventDispatches()

// Show flow for a specific user (requester)
CounterDebugger.showRequesterFlow('user-uuid-here')

// Clear the log
CounterDebugger.clear()

// Disable debugging temporarily
CounterDebugger.setEnabled(false)

// Re-enable debugging
CounterDebugger.setEnabled(true)
```

### Testing Scenario: Requester Accepting Response

To test the counter update when a requester accepts a reciprocal response:

1. **Login as the requester** (parent who created the care request)

2. **Open browser console and run:**
   ```javascript
   CounterDebugger.clear()
   console.log('Starting test: Requester accepting response')
   ```

3. **Accept a reciprocal response** from the Scheduler page

4. **Check the console for this flow:**
   ```
   ✅ RECIPROCAL RESPONSE ACCEPTED
   📡 EVENT DISPATCHED: "schedulerCountUpdated"
   📡 EVENT DISPATCHED: "calendarCountUpdated"
   📥 EVENT RECEIVED: "calendarCountUpdated"
   🔄 FETCHING CALENDAR Counter
   📊 CALENDAR Counter Calculated
   ```

5. **Verify the calendar counter incremented** in the Header

6. **Run this to see the full flow:**
   ```javascript
   CounterDebugger.showCounterFlow()
   ```

### What to Look For

**Expected Flow:**
1. `RECIPROCAL_ACCEPTANCE` logged with requester ID
2. `EVENT_DISPATCH: calendarCountUpdated` from Scheduler
3. `EVENT_RECEIVED: calendarCountUpdated` in Header
4. `COUNTER_FETCH: calendar` in Header
5. `COUNTER_CALCULATION: calendar` showing the new notification
6. Calendar counter badge updates in UI

**If Counter Doesn't Update:**

Check for:
- ❌ **Missing EVENT_DISPATCH:** Events not being dispatched from Scheduler
- ❌ **Missing EVENT_RECEIVED:** Header not listening to events
- ❌ **Missing NOTIFICATION:** No `care_accepted` notification created
- ❌ **DATABASE_ERROR:** Function errors preventing notification creation
- ❌ **COUNTER_CALCULATION shows 0 notifications:** Notification not being fetched or filtered out

### Testing Scenario: Open Block Acceptance

1. **Login as the parent accepting the open block**

2. **Clear logs and start test:**
   ```javascript
   CounterDebugger.clear()
   console.log('Starting test: Open block acceptance')
   ```

3. **Accept an open block invitation**

4. **Check for:**
   - `OPEN_BLOCK_ACCEPTANCE` log
   - `EVENT_DISPATCH: calendarCountUpdated`
   - Calendar counter increment for acceptor

5. **Login as the offerer** (parent who created the open block)

6. **Check if THEIR calendar counter updated** (this is the key issue)

7. **Review logs:**
   ```javascript
   CounterDebugger.showCounterFlow()
   ```

## Debugging Checklist

When calendar counter doesn't update for requester:

- [ ] Check if `care_accepted` notification is created (check Supabase `notifications` table)
- [ ] Verify notification has `user_id` matching the requester
- [ ] Verify notification has `is_read = false`
- [ ] Check if notification has `data.blocks_created` field
- [ ] Verify `accept_reciprocal_care_response` function creates notification
- [ ] Check event dispatch logs in console
- [ ] Check event received logs in console
- [ ] Verify counter calculation includes the new notification
- [ ] Check if there's a race condition (notification not created before counter fetch)

## Common Issues and Fixes

### Issue: Event dispatched but not received
**Fix:** Check if Header component is mounted and event listeners are registered

### Issue: Notification created but counter shows 0
**Fix:** Check if notification has `is_read = false` and matches the user_id

### Issue: Counter updates for responder but not requester
**Fix:** Check if `accept_reciprocal_care_response` creates notifications for BOTH parties

### Issue: localStorage counter out of sync
**Fix:** Calendar counter now relies on database notifications only (not localStorage)

## Next Steps

1. Test the debugger by accepting a reciprocal response as a requester
2. Review the console logs to identify where the flow breaks
3. Check the Supabase `notifications` table to verify notification creation
4. If notifications aren't being created, review the `accept_reciprocal_care_response` function
5. Report findings using the debugger output

## Database Function to Check

Verify this function creates notifications for the REQUESTER:

```sql
-- Check what accept_reciprocal_care_response does
SELECT routine_definition
FROM information_schema.routines
WHERE routine_name = 'accept_reciprocal_care_response';
```

The function should:
1. Create 2 scheduled_care blocks (one for requester receiving care, one for responder providing reciprocal care)
2. Create `care_accepted` notification for RESPONDER
3. Create `care_accepted` notification for REQUESTER (this might be missing!)
4. Both notifications should have `blocks_created = 2` in their data field
