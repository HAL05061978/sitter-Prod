# Complete Counter Decline Fix - Bypass Modal for Counter-Proposals

## Problem

Even after detecting that a request was a counter-proposal, the modal was still opening and showing the full decline UI with arrangement selection.

**Console showed:**
```
Care Request ID: 4314bfef-132a-4f2f-b83c-8f022881adce ✅
✅ Is counter-proposal: true ✅
Fetching arrangements between... ❌ (Modal still opened)
```

## Root Cause

The `handleRescheduleResponse` function was checking for decline and immediately opening the modal, WITHOUT first checking if it was a counter-proposal. The modal detection came too late - the UI was already shown.

**The Flow (BEFORE):**
1. User clicks "Decline" on counter-proposal
2. `handleRescheduleResponse` → Opens modal immediately
3. Modal loads and detects `is_counter_proposal: true`
4. **But it's too late** - the full decline UI is already showing

## The Solution

Check if it's a counter-proposal BEFORE opening the modal. If it is, process the decline immediately with a simple confirmation dialog and NEVER open the modal.

### Updated handleRescheduleResponse (Lines 2052-2135)

**Key Changes:**

1. **Line 2076-2090:** Query `care_requests` to check `counter_proposal_to` field
2. **Lines 2092-2125:** If counter-proposal, show simple confirm dialog and call backend directly
3. **Lines 2127-2134:** Only open modal if NOT a counter-proposal

### The Code:

```typescript
const handleRescheduleResponse = async (careResponseId: string, response: 'accepted' | 'declined', notes?: string, careRequestId?: string) => {
  try {
    if (response === 'declined') {
      console.log('=== HANDLING RESCHEDULE DECLINE ===');

      // Ensure we have careRequestId
      if (!careRequestId) {
        const { data: responseData, error: responseError } = await supabase
          .from('care_responses')
          .select('request_id')
          .eq('id', careResponseId)
          .single();
        if (responseError || !responseData) {
          console.error('Could not find care request:', responseError);
          return;
        }
        careRequestId = responseData.request_id;
      }

      // ✅ CHECK IF COUNTER-PROPOSAL BEFORE OPENING MODAL
      const { data: requestData, error: requestError } = await supabase
        .from('care_requests')
        .select('counter_proposal_to')
        .eq('id', careRequestId)
        .single();

      if (requestError) {
        console.error('Error checking if counter-proposal:', requestError);
        return;
      }

      const isCounterProposal = requestData.counter_proposal_to !== null;
      console.log('✅ Is counter-proposal:', isCounterProposal);

      if (isCounterProposal) {
        // ✅ COUNTER-PROPOSAL: Decline immediately without modal
        console.log('Counter-proposal detected - declining immediately without modal');

        const confirmed = window.confirm(
          'Are you sure you want to decline this counter-proposal? The parent will be notified and their selected arrangement will be canceled.'
        );

        if (!confirmed) return;

        setProcessingReschedule(true);

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          showAlertOnce('User not authenticated');
          return;
        }

        // Call backend directly - NO MODAL SHOWN
        const { data, error } = await supabase.rpc('handle_improved_reschedule_response', {
          p_care_response_id: careResponseId,
          p_responder_id: user.id,
          p_response_status: 'declined',
          p_response_notes: notes || null,
          p_decline_action: null,
          p_selected_cancellation_request_id: null
        });

        if (error) throw error;

        showAlertOnce('You have declined the counter-proposal. The parent has been notified.');
        await fetchData();
        setProcessingReschedule(false);
        return; // ✅ Exit without opening modal
      }

      // ✅ NOT A COUNTER-PROPOSAL: Show full modal
      console.log('Original reschedule - showing modal with decline options');
      setSelectedRescheduleRequest({
        requestId: careRequestId,
        responseId: careResponseId
      });
      setShowRescheduleResponseModal(true);
      return;
    }

    // ... rest of accept logic
  } catch (err) {
    console.error('Error:', err);
  }
};
```

## How It Works Now

### Declining a Counter-Proposal:

1. User clicks "Decline" on counter-proposal message
2. `handleRescheduleResponse` called with `careRequestId`
3. **Checks `counter_proposal_to` field** from database
4. **Detects:** `counter_proposal_to !== null` → It's a counter!
5. **Shows simple confirm dialog** (window.confirm)
6. **User confirms** → Calls backend RPC directly
7. **Backend removes** both parties' children from blocks
8. **Both parents** receive decline notifications
9. **Modal NEVER opens** ✅

### Declining an Original Reschedule:

1. User clicks "Decline" on original reschedule message
2. `handleRescheduleResponse` called with `careRequestId`
3. **Checks `counter_proposal_to` field** from database
4. **Detects:** `counter_proposal_to === null` → Original reschedule
5. **Opens modal** with full decline options
6. User selects arrangement and optionally offers counter
7. Submits via modal

## Files Changed

### `app/scheduler/page.tsx`
- **Lines 534, 541:** Added `request.request_id` parameter to button handlers
- **Lines 2052-2135:** Added counter-proposal detection before opening modal

### `components/care/RescheduleResponseModal.tsx`
- **Lines 93-141:** Query `care_requests` directly for `counter_proposal_to` field

## Build Status

✅ **Compiled successfully** - No errors, no warnings

## Expected Console Output

### For Counter-Proposal Decline:
```
=== HANDLING RESCHEDULE DECLINE ===
Care Request ID: 4314bfef-132a-4f2f-b83c-8f022881adce
✅ Is counter-proposal: true
Counter-proposal detected - declining immediately without modal
[User confirms]
You have declined the counter-proposal. The parent has been notified.
```

**NO modal opens, NO arrangements fetched** ✅

### For Original Reschedule Decline:
```
=== HANDLING RESCHEDULE DECLINE ===
Care Request ID: e2abd992-6836-493e-af88-c62c82bc4e9a
✅ Is counter-proposal: false
Original reschedule - showing modal with decline options
[Modal opens with arrangement selection]
```

## Summary

The fix moves the counter-proposal detection from INSIDE the modal to BEFORE opening the modal. This way:

- **Counter-proposals** → Simple confirm dialog → Immediate decline → No modal
- **Original reschedules** → Full modal → Arrangement selection → Counter-proposal option

This is the correct UX flow where counter-proposals cannot be countered again, they can only be accepted or declined.

## Related Backend Fix

Make sure you've deployed: `DEPLOY_RESCHEDULE_DECLINE_NOTIFICATIONS_PHASE2_FIXED.sql`

This fixes the variable overwrite bug that was removing the wrong children from blocks.

Both frontend and backend fixes are now complete!
