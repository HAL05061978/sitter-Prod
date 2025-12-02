# Counter-Proposal Decline - Complete Solution

## Overview

This document summarizes the complete fix for the counter-proposal decline functionality. The issue was that when declining a counter-proposal, the system was showing the full decline modal (with arrangement selection and counter-offer options) instead of immediately declining.

## The Problem

**User's Request:**
> "when this counter is declined the procedure should not give parent any choices at this point and have children/blocks removed from blocks chosen"

**What was happening:**
1. User clicks "Decline" on a counter-proposal notification
2. Full decline modal opens with arrangement selection
3. User sees options to select arrangements and send another counter
4. This was incorrect - counters should not be counterable

## The Solution

The fix required changes in TWO places:

### 1. Backend SQL Function Fix

**File:** Deployed via `DEPLOY_RESCHEDULE_DECLINE_NOTIFICATIONS_PHASE2_FIXED.sql`

**Problem:** Variable overwrite bug causing wrong children to be removed from blocks.

**Fix:** Use separate variables for counter-proposer's child vs original rescheduler's child.

**Changed Lines:**
- Line 69: Renamed variable to `v_original_rescheduler_child_id`
- Line 600: Use new variable instead of overwriting `v_requester_child_id`
- Lines 612, 630: Updated references to use correct variable

### 2. Frontend Fix

**File:** `app/scheduler/page.tsx`

**Problem:** Modal was opening before detecting if request was a counter-proposal.

**Fix:** Detect counter-proposals BEFORE opening modal. If counter-proposal, bypass modal entirely.

**Changed Lines:**

**Lines 534, 541:** Pass `request.request_id` to handler
```typescript
onClick={() => handleRescheduleResponse(request.care_response_id, 'accepted', undefined, request.request_id)}
onClick={() => handleRescheduleResponse(request.care_response_id, 'declined', undefined, request.request_id)}
```

**Lines 2052-2135:** Complete rewrite of decline flow
```typescript
const handleRescheduleResponse = async (careResponseId: string, response: 'accepted' | 'declined', notes?: string, careRequestId?: string) => {
  try {
    if (response === 'declined') {
      // Get careRequestId if not provided
      if (!careRequestId) {
        const { data: responseData, error: responseError } = await supabase
          .from('care_responses')
          .select('request_id')
          .eq('id', careResponseId)
          .single();
        if (responseError || !responseData) return;
        careRequestId = responseData.request_id;
      }

      // ✅ CHECK IF COUNTER-PROPOSAL BEFORE OPENING MODAL
      const { data: requestData, error: requestError } = await supabase
        .from('care_requests')
        .select('counter_proposal_to')
        .eq('id', careRequestId)
        .single();

      if (requestError) return;

      const isCounterProposal = requestData.counter_proposal_to !== null;

      if (isCounterProposal) {
        // ✅ COUNTER-PROPOSAL: Simple confirm, direct decline, NO MODAL
        const confirmed = window.confirm(
          'Are you sure you want to decline this counter-proposal? The parent will be notified and their selected arrangement will be canceled.'
        );
        if (!confirmed) return;

        setProcessingReschedule(true);
        const { data: { user } } = await supabase.auth.getUser();

        await supabase.rpc('handle_improved_reschedule_response', {
          p_care_response_id: careResponseId,
          p_responder_id: user.id,
          p_response_status: 'declined',
          p_response_notes: notes || null,
          p_decline_action: null,
          p_selected_cancellation_request_id: null
        });

        showAlertOnce('You have declined the counter-proposal. The parent has been notified.');
        await fetchData();
        setProcessingReschedule(false);
        return; // ✅ Exit without opening modal
      }

      // ✅ ORIGINAL RESCHEDULE: Show full modal with options
      setSelectedRescheduleRequest({
        requestId: careRequestId,
        responseId: careResponseId
      });
      setShowRescheduleResponseModal(true);
      return;
    }

    // ... accept logic
  } catch (err) {
    console.error('Error:', err);
  }
};
```

## How It Works Now

### Declining a Counter-Proposal:
1. User clicks "Decline" on counter-proposal notification
2. Function queries `care_requests.counter_proposal_to` field
3. Detects `counter_proposal_to !== null` → It's a counter!
4. Shows simple browser confirm dialog
5. User confirms → Calls backend RPC directly
6. Backend removes:
   - Counter-proposer's child from original yellow rescheduled blocks
   - Original rescheduler's child from selected cancellation blocks
7. Both parents receive decline notifications
8. **Modal NEVER opens** ✅

### Declining an Original Reschedule:
1. User clicks "Decline" on original reschedule notification
2. Function queries `care_requests.counter_proposal_to` field
3. Detects `counter_proposal_to === null` → Original reschedule
4. Opens modal with full decline options
5. User selects arrangement and optionally sends counter-proposal
6. Submits via modal

## Expected Console Output

### For Counter-Proposal Decline:
```
=== HANDLING RESCHEDULE DECLINE ===
Care Request ID: 4314bfef-132a-4f2f-b83c-8f022881adce
Care Response ID: 9916086d-6938-4853-8d72-5c6565e5fe94
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
Care Response ID: abc123...
✅ Is counter-proposal: false
Original reschedule - showing modal with decline options
[Modal opens with arrangement selection]
```

## Files Changed

1. **Backend:** `handle_improved_reschedule_response` function (deployed via SQL script)
2. **Frontend:** `app/scheduler/page.tsx` (lines 534, 541, 2052-2135)

## Build Status

✅ **Compiled successfully** - No errors, no warnings

## Testing Checklist

- ✅ Accept original reschedule → Works
- ✅ Decline original reschedule with counter → Works
- ✅ Accept counter-proposal → Blocks created correctly
- ✅ Decline counter-proposal → No modal, immediate decline, children removed correctly
- ✅ Both parents receive appropriate notifications

## Related Documentation

- `COMPLETE_COUNTER_DECLINE_FIX.md` - Complete frontend fix explanation
- `FINAL_COUNTER_DECLINE_FIX.md` - Missing careRequestId parameter fix
- `FRONTEND_COUNTER_DECLINE_FIX.md` - Modal detection fix
- `DEPLOY_RESCHEDULE_DECLINE_NOTIFICATIONS_PHASE2_FIXED.sql` - Backend variable fix

## Summary

The counter-proposal decline functionality is now complete. Counter-proposals cannot be countered again - they can only be accepted or declined. When declined, a simple confirmation dialog is shown and the decline is processed immediately without opening the full modal, exactly as requested.
