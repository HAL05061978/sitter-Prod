# Counter Decline Modal Fix - COMPLETE

## Problem

When a user tried to decline a counter-proposal, the modal was showing the full decline popup (with arrangement selection and counter-proposal options) instead of immediately declining.

**User Report:**
> "the Counter to Accept worked as expected BUT I try to decline a counter it opens the same pop up to counter again. When a counter is declined no pop up is needed and it should just decline the original reschedule block with the selected block that countering party selected...this is how it worked before"

## Root Causes (TWO BUGS)

### Bug #1: Missing is_counter_proposal Flag

The `RescheduleResponseModal.tsx` was calling the old `get_reschedule_request_details` RPC function which used the deprecated `care_reschedule_requests` table. This function was NOT returning the `is_counter_proposal` flag correctly.

The modal's `handleDeclineClick` function (line 186) was checking:
```typescript
if (rescheduleDetails?.reschedule_request?.is_counter_proposal) {
  await handleSimpleDecline();
} else {
  setShowDeclineOptions(true); // ❌ This was always being triggered
}
```

Since `is_counter_proposal` was never set, the condition always failed, and it always showed the full decline options.

### Bug #2: showDeclineOptions Starting as true

Even worse, the modal state was initialized with:
```typescript
const [showDeclineOptions, setShowDeclineOptions] = useState(true); // ❌ BUG
```

This meant the full decline UI was showing IMMEDIATELY when the modal opened, without the user even clicking "Decline" first!

## Solution

### Fix #1: Query care_requests Directly

Updated `fetchRescheduleDetails` function in `RescheduleResponseModal.tsx` (lines 93-139) to:

1. **Query `care_requests` table directly** instead of using the old RPC function
2. **Check `counter_proposal_to` field** to determine if it's a counter-proposal
3. **Set `is_counter_proposal` flag** correctly in the reschedule details

### Fix #2: Start with showDeclineOptions as false

Changed line 77:
```typescript
// BEFORE:
const [showDeclineOptions, setShowDeclineOptions] = useState(true);

// AFTER:
const [showDeclineOptions, setShowDeclineOptions] = useState(false); // ✅ FIX
```

This ensures the modal shows the simple Accept/Decline view first, and only shows the full decline UI when the user clicks "Decline" on an original reschedule.

### Fix #3: Optimization - Don't Fetch Arrangements Until Needed

Removed `fetchArrangements()` call from `useEffect` (line 89) because:
- For counter-proposals: Arrangements are never needed
- For original reschedules: Arrangements are only needed AFTER user clicks "Decline"

Now `fetchArrangements()` is only called in `handleDeclineClick()` when needed (line 196).

### Key Changes:

**Before:**
```typescript
const { data, error } = await supabase.rpc('get_reschedule_request_details', {
  p_reschedule_request_id: rescheduleRequestId
});
```

**After:**
```typescript
// ✅ FIX: Query care_requests directly to check if this is a counter-proposal
const { data: requestData, error: requestError } = await supabase
  .from('care_requests')
  .select('id, counter_proposal_to, requester_id, requested_date, start_time, end_time, reciprocal_date, reciprocal_start_time, reciprocal_end_time, notes')
  .eq('id', rescheduleRequestId)
  .single();

// Build the reschedule details with is_counter_proposal flag
const details = {
  reschedule_request: {
    id: requestData.id,
    is_counter_proposal: requestData.counter_proposal_to !== null, // ✅ KEY FIX
    counter_proposal_to: requestData.counter_proposal_to
  },
  // ...
};
```

## How It Works Now

### Counter-Proposal Detection:
1. Modal fetches care_requests record for the reschedule request
2. Checks if `counter_proposal_to` field is NOT NULL
3. Sets `is_counter_proposal: true` in reschedule details

### Counter Decline Flow:
1. User clicks "Decline" on a counter-proposal message
2. `handleDeclineClick` executes (line 155)
3. Detects `is_counter_proposal === true`
4. Calls `handleSimpleDecline()` (line 161)
5. `handleSimpleDecline` calls backend with:
   ```typescript
   p_response_status: 'declined',
   p_decline_action: null,
   p_selected_cancellation_request_id: null
   ```
6. Backend detects it's a counter via `v_is_responding_to_counter := (v_care_request.counter_proposal_to IS NOT NULL)` (SQL line 91)
7. Backend automatically uses the arrangement Bruce selected when sending the counter (SQL lines 583-590)
8. Both blocks removed (counter-proposal + selected arrangement)
9. Both parents receive decline notifications

## Backend Logic (Already Working)

The backend SQL in `DEPLOY_RESCHEDULE_DECLINE_NOTIFICATIONS_PHASE2.sql` was already handling counter declines correctly:

**Line 91:** Detects counter-proposals automatically
```sql
v_is_responding_to_counter := (v_care_request.counter_proposal_to IS NOT NULL);
```

**Lines 556-642:** Counter decline logic
- Removes counter-proposer's child from yellow blocks
- Retrieves the arrangement counter-proposer selected when sending counter
- Removes only the rescheduler's child from that selected arrangement
- Creates decline notifications for both parents

The backend didn't need any changes - it was the **frontend** that wasn't correctly detecting counter-proposals.

## Files Changed

### `components/care/RescheduleResponseModal.tsx`

**Line 77:** Fixed initial state
```typescript
const [showDeclineOptions, setShowDeclineOptions] = useState(false); // ✅ FIX
```

**Lines 86-92:** Removed premature fetchArrangements call
```typescript
useEffect(() => {
  if (isOpen && rescheduleRequestId) {
    fetchRescheduleDetails();
    // ✅ Don't fetch arrangements until user clicks decline (optimization)
  }
}, [isOpen, rescheduleRequestId]);
```

**Lines 93-139:** Updated fetchRescheduleDetails function
- Now queries `care_requests` table directly
- Correctly sets `is_counter_proposal` flag based on `counter_proposal_to` field

## Build Status

✅ **Compiled successfully** - No errors, no warnings

## User Experience Flow

### For Counter-Proposals:
1. User clicks "Decline" on counter-proposal notification → Modal opens
2. Modal shows simple view with reschedule details and Accept/Decline buttons
3. User clicks "Decline" button → `handleDeclineClick()` detects `is_counter_proposal: true`
4. Immediately calls `handleSimpleDecline()` → Shows confirmation dialog
5. User confirms → Backend processes decline using pre-selected arrangement
6. Both blocks removed, both parents notified

### For Original Reschedules:
1. User clicks "Decline" on reschedule notification → Modal opens
2. Modal shows simple view with reschedule details and Accept/Decline buttons
3. User clicks "Decline" button → `handleDeclineClick()` detects `is_counter_proposal: false`
4. Shows full decline UI with arrangement selection and counter-proposal options
5. User selects arrangement and optionally offers counter
6. User submits → Backend processes accordingly

## Testing Checklist

- [ ] User declines a counter-proposal
- [ ] Modal does NOT show the decline options popup
- [ ] Simple confirmation dialog appears
- [ ] After confirming, both blocks are removed from calendar
- [ ] Both parents receive "Counter declined" notifications
- [ ] Notifications show both cancelled blocks (declined counter + selected arrangement)

## Summary

This was a **frontend-only fix**. The backend was already handling counter-proposal declines correctly, but the frontend modal wasn't detecting when a reschedule request was a counter-proposal.

By querying the `care_requests` table directly and checking the `counter_proposal_to` field, the modal now correctly identifies counter-proposals and calls `handleSimpleDecline()` instead of showing the full decline options.
