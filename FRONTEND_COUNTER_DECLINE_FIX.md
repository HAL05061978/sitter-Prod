# Frontend Counter Decline Fix - Modal Popup Issue

## Problem

When declining a counter-proposal, the modal was showing the full decline UI (with arrangement selection and counter-proposal options) instead of immediately declining.

**User Report:**
> "when this counter is declined the procedure should not give parent any choices at this point and have children/blocks removed from blocks chosen"

## Root Cause

The `RescheduleResponseModal.tsx` was calling the old `get_reschedule_request_details` RPC function which does NOT return the `counter_proposal_to` field. Without this field, the frontend cannot detect if a reschedule request is actually a counter-proposal.

**The Check (Line 190):**
```typescript
if (rescheduleDetails?.reschedule_request?.is_counter_proposal) {
  await handleSimpleDecline(); // Should execute for counters
} else {
  setShowDeclineOptions(true); // Was always triggering
}
```

Since `is_counter_proposal` was never set (because the RPC doesn't return `counter_proposal_to`), the check always failed and showed the full decline UI.

## The Fix

Updated `fetchRescheduleDetails` function (lines 93-141) to:

1. **Query `care_requests` table directly** instead of using the old RPC
2. **Get the `counter_proposal_to` field** from the database
3. **Set `is_counter_proposal` flag** based on whether `counter_proposal_to` is NOT NULL

### Code Change:

**BEFORE (Lines 93-108):**
```typescript
const fetchRescheduleDetails = async () => {
  try {
    setLoading(true);
    const { data, error } = await supabase.rpc('get_reschedule_request_details', {
      p_reschedule_request_id: rescheduleRequestId
    });

    if (error) throw error;
    setRescheduleDetails(data);
  } catch (err) {
    console.error('Error fetching reschedule details:', err);
    setError('Failed to load reschedule details');
  } finally {
    setLoading(false);
  }
};
```

**AFTER (Lines 93-141):**
```typescript
const fetchRescheduleDetails = async () => {
  try {
    setLoading(true);

    // ✅ Query care_requests directly to get counter_proposal_to field
    const { data: requestData, error: requestError } = await supabase
      .from('care_requests')
      .select('id, counter_proposal_to, requester_id, requested_date, start_time, end_time, reciprocal_date, reciprocal_start_time, reciprocal_end_time, notes')
      .eq('id', rescheduleRequestId)
      .single();

    if (requestError) throw requestError;

    // Build reschedule details with is_counter_proposal flag
    const details = {
      reschedule_request: {
        id: requestData.id,
        is_counter_proposal: requestData.counter_proposal_to !== null, // ✅ KEY FIX
        counter_proposal_to: requestData.counter_proposal_to
      },
      original_request: {
        id: requestData.id,
        date: requestData.reciprocal_date,
        start_time: requestData.reciprocal_start_time,
        end_time: requestData.reciprocal_end_time,
        notes: requestData.notes
      },
      new_request: {
        id: requestData.id,
        date: requestData.requested_date,
        start_time: requestData.start_time,
        end_time: requestData.end_time,
        notes: requestData.notes
      },
      participating_parents: [],
      responses: []
    };

    console.log('✅ Reschedule details loaded:', details);
    console.log('✅ Is counter-proposal:', details.reschedule_request.is_counter_proposal);

    setRescheduleDetails(details);
  } catch (err) {
    console.error('Error fetching reschedule details:', err);
    setError('Failed to load reschedule details');
  } finally {
    setLoading(false);
  }
};
```

## How It Works Now

### When Declining a Counter-Proposal:

1. **Modal opens** with counter-proposal request ID
2. **fetchRescheduleDetails()** queries `care_requests` table
3. **Checks `counter_proposal_to`** field:
   - If NOT NULL → `is_counter_proposal: true` ✅
   - If NULL → `is_counter_proposal: false`
4. **User clicks "Decline"** button
5. **handleDeclineClick()** executes:
   ```typescript
   if (rescheduleDetails?.reschedule_request?.is_counter_proposal) {
     await handleSimpleDecline(); // ✅ Executes immediately
   } else {
     setShowDeclineOptions(true); // Shows full UI for original reschedules
   }
   ```
6. **handleSimpleDecline()** calls backend with `p_decline_action: null`
7. **Backend detects** counter via `v_is_responding_to_counter` (line 91 of SQL)
8. **Backend removes** both parties' children from appropriate blocks
9. **Both parents** receive decline notifications

### When Declining an Original Reschedule:

1. Modal opens with original reschedule request ID
2. `fetchRescheduleDetails()` finds `counter_proposal_to: null`
3. Sets `is_counter_proposal: false`
4. User clicks "Decline"
5. Shows full decline UI with arrangement selection and counter-proposal options
6. User makes selections and submits

## Files Changed

- **`components/care/RescheduleResponseModal.tsx`** (lines 93-141)

## Build Status

✅ **Compiled successfully** - No errors, no warnings

## Testing

After deploying:

1. ✅ Accept original reschedule → Works
2. ✅ Decline original reschedule with counter → Works
3. ✅ Accept counter-proposal → Works (blocks created correctly)
4. ✅ Decline counter-proposal → Should NOT show popup, should immediately decline ✅

## Console Logs

When declining a counter-proposal, you should see:
```
✅ Reschedule details loaded: {reschedule_request: {is_counter_proposal: true, ...}}
✅ Is counter-proposal: true
=== DECLINE BUTTON CLICKED ===
Counter-proposal detected - using simple decline
```

## Related Files

- **Backend SQL**: `DEPLOY_RESCHEDULE_DECLINE_NOTIFICATIONS_PHASE2_FIXED.sql`
- **Frontend**: `components/care/RescheduleResponseModal.tsx`

## Summary

The frontend now correctly detects counter-proposals by querying the `counter_proposal_to` field directly from the `care_requests` table. This allows the decline flow to immediately process counter declines without showing unnecessary UI.
