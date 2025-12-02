# Phase 2 Deployment Summary: Reschedule Decline Notifications

## Overview
This deployment adds decline notifications to the reschedule workflow. When a parent declines a reschedule request (without sending a counter-proposal), both parties now receive notifications documenting the decline and showing which blocks were cancelled.

## Files Changed

### Backend
- **File:** `DEPLOY_RESCHEDULE_DECLINE_NOTIFICATIONS_PHASE2.sql`
- **Lines:** 972 (complete function)
- **Base:** Built on Phase 1 (already deployed)
- **Changes:** Added 47 lines of notification logic

### Frontend
- **File:** `app/scheduler/page.tsx`
- **Changes:**
  1. Made `reschedule_declined` messages expandable (removed from non-expandable list)
  2. Added expanded view showing cancelled blocks in red box
  3. Shows both cancelled blocks (providing + needed) with date/time

## What Was Added

### SQL Changes (Lines 852-897)

Added decline notifications in the "Original Reschedule Being Declined" section:

```sql
-- ✅ ADD DECLINE NOTIFICATIONS HERE (Phase 2)
RAISE NOTICE 'Creating reschedule decline notifications';

-- Notification for requester (person who initiated reschedule)
INSERT INTO notifications (user_id, type, title, message, data)
VALUES (
    v_care_request.requester_id,
    'reschedule_declined',
    (SELECT full_name FROM profiles WHERE id = p_responder_id) ||
        ' declined your reschedule request for ' ||
        TO_CHAR(v_care_request.reciprocal_date, 'Mon DD, YYYY'),
    '',
    jsonb_build_object(
        'requester_id', v_care_request.requester_id,
        'responder_id', p_responder_id,
        'responder_name', (SELECT full_name FROM profiles WHERE id = p_responder_id),
        'cancelled_date', v_care_request.reciprocal_date,
        'cancelled_start_time', v_care_request.reciprocal_start_time,
        'cancelled_end_time', v_care_request.reciprocal_end_time,
        'care_response_id', p_care_response_id
    )
);

-- Notification for responder (person who declined)
INSERT INTO notifications (user_id, type, title, message, data)
VALUES (
    p_responder_id,
    'reschedule_declined',
    'You declined ' ||
        (SELECT full_name FROM profiles WHERE id = v_care_request.requester_id) ||
        '''s reschedule request for ' ||
        TO_CHAR(v_care_request.reciprocal_date, 'Mon DD, YYYY'),
    '',
    jsonb_build_object(
        'requester_id', v_care_request.requester_id,
        'requester_name', (SELECT full_name FROM profiles WHERE id = v_care_request.requester_id),
        'responder_id', p_responder_id,
        'cancelled_date', v_care_request.reciprocal_date,
        'cancelled_start_time', v_care_request.reciprocal_start_time,
        'cancelled_end_time', v_care_request.reciprocal_end_time,
        'care_response_id', p_care_response_id
    )
);

RAISE NOTICE 'Reschedule decline notifications created successfully';
```

## Insertion Point

The notifications are inserted **after** all block operations complete successfully:
- After removing child from providing block (or cancelling if empty)
- After removing child from needed blocks
- After deleting meaningless needed blocks
- After handling yellow block cleanup
- After handling selected cancellation request (if any)

This ensures:
1. Block operations complete successfully before notifications
2. No duplicate notifications if errors occur
3. Notifications accurately reflect what was cancelled

## What Users Will See

### When Requester Receives Notification:
- **Title:** "{Name} declined your reschedule request for Nov 3, 2025"
- **Badge:** Red "Declined" badge
- **Expandable:** Yes - shows cancelled blocks details
- **Details:**
  - Red-bordered box
  - "Cancelled care blocks"
  - Date and time of both cancelled blocks
  - Message: "Both the providing and needed care blocks were removed"

### When Decliner Receives Notification:
- **Title:** "You declined {Name}'s reschedule request for Nov 3, 2025"
- **Badge:** Red "Declined" badge
- **Expandable:** Yes - shows cancelled blocks details
- **Details:** Same as above

## Safety Features

1. **No Logic Changes:** Only adds notifications, doesn't modify existing block handling
2. **Inline Subqueries:** Avoids variable scope issues in PL/pgSQL
3. **After Operations:** Notifications created only after successful block operations
4. **Complete Function:** All 972 lines preserved from Phase 1 + Phase 2 additions
5. **Comprehensive Logging:** RAISE NOTICE statements for debugging

## Comparison with Phase 1

### Phase 1 (Already Deployed):
- 925 lines total
- Added acceptance notifications only
- Notification types: `reschedule_accepted`

### Phase 2 (This Deployment):
- 972 lines total (+47 lines)
- Added decline notifications
- Notification types: `reschedule_accepted`, `reschedule_declined`

## Testing Checklist

- [ ] Deploy SQL to production
- [ ] Test decline flow: Requester receives notification
- [ ] Test decline flow: Decliner receives notification
- [ ] Verify both notifications show correct cancelled date/time
- [ ] Verify expandable view shows both cancelled blocks
- [ ] Verify no duplicate notifications
- [ ] Verify acceptance notifications still work (Phase 1)
- [ ] Check logs for "Reschedule decline notifications created successfully"

## Rollback Plan

If issues occur, rollback to Phase 1:
1. Re-run `DEPLOY_RESCHEDULE_ACCEPTANCE_NOTIFICATIONS_PHASE1.sql`
2. Frontend will continue to work (decline messages just won't display)
3. No data loss - only notification creation affected

## Next Phase

**Phase 3:** Counter-proposal notifications
- Notification when counter-proposal is sent
- Notification when counter-proposal is accepted/declined

## Files in This Deployment

1. `DEPLOY_RESCHEDULE_DECLINE_NOTIFICATIONS_PHASE2.sql` - Backend SQL
2. `app/scheduler/page.tsx` - Frontend updates (already built successfully)
3. `DEPLOY_PHASE2_SUMMARY.md` - This summary document
