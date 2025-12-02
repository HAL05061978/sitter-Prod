# Counter-Proposal Notification Display Fix

## Problems Fixed
1. **BEFORE decision:** TWO messages were showing when counter was sent:
   - "Hugo Lopez wants to reschedule..." with buttons (should NOT show)
   - "Hugo Lopez sent a counter-proposal..." with buttons (should show)

2. **AFTER decision:** Counter-proposal message wasn't disappearing after accept/decline

## Solution
Modified `app/scheduler/page.tsx` with TWO filtering improvements:

1. **Lines 528-547:** Hide original reschedule request when counter is PENDING
2. **Lines 583-596:** Hide counter-sent notification after it's been answered

## Code Changes

### File: `app/scheduler/page.tsx`

**Change 1: Lines 528-547 - Filter out original reschedule requests with pending counters**
```typescript
// Get original request IDs that have PENDING counter-proposals (not yet answered)
// We only hide the original request if the counter is still pending
const originalRequestIdsWithPendingCounters = new Set();
rescheduleNotifications.forEach(notification => {
  if (notification.type === 'reschedule_counter_sent') {
    const counterRequestId = notification.data?.counter_request_id;
    const originalRequestId = notification.data?.original_request_id;

    // Check if this counter has been answered
    const hasBeenAnswered = rescheduleNotifications.some(n =>
      (n.type === 'reschedule_counter_accepted' || n.type === 'reschedule_counter_declined') &&
      n.data?.counter_request_id === counterRequestId
    );

    // Only add to the set if the counter is PENDING (not yet answered)
    if (!hasBeenAnswered && originalRequestId) {
      originalRequestIdsWithPendingCounters.add(originalRequestId);
    }
  }
});

// Then skip if this request has a PENDING counter-proposal
if (originalRequestIdsWithPendingCounters.has(requestId)) {
  console.log('Skipping reschedule_request message - has pending counter-proposal:', requestId);
  return;
}
```

**Change 2: Lines 583-596 - Filter out answered counter-sent notifications**
```typescript
// Skip counter_sent notifications if they've been answered (accepted/declined)
if (notification.type === 'reschedule_counter_sent') {
  const counterRequestId = notification.data?.counter_request_id;
  const hasBeenAnswered = rescheduleNotifications.some(n =>
    (n.type === 'reschedule_counter_accepted' || n.type === 'reschedule_counter_declined') &&
    n.data?.counter_request_id === counterRequestId
  );

  if (hasBeenAnswered) {
    console.log('Skipping counter_sent notification - already answered:', counterRequestId);
    return; // Skip this notification
  }
}
```

## How It Works

### When Counter is Sent (Pending):
1. Original reschedule notification exists: "Hugo Lopez wants to reschedule..."
2. Counter-sent notification exists: "Hugo Lopez sent a counter-proposal..."
3. **Filter 1 hides the original** (because counter is pending)
4. **Only counter-sent shows** with buttons

### After Counter is Accepted/Declined:
1. Original reschedule notification exists
2. Counter-sent notification exists
3. Counter-accepted/declined notification exists
4. **Filter 1 allows original to show** (counter no longer pending)
5. **Filter 2 hides counter-sent** (already answered)
6. **Only accepted/declined message shows**

## Expected Behavior

### When Counter is Sent (Pending):
- ✅ Hides original "Hugo Lopez wants to reschedule..." message
- ✅ Shows ONLY "Hugo Lopez sent a counter-proposal..." with Accept/Decline buttons
- ✅ Shows comparison: original vs counter times
- ✅ Shows "block at risk" info

### After Accepting Counter:
- ✅ Hides counter-proposal message with buttons
- ✅ Shows ONLY "You accepted Hugo Lopez's counter-proposal..." with new care block details

### After Declining Counter:
- ✅ Hides counter-proposal message with buttons
- ✅ Shows ONLY "You declined Bruce H's counter-proposal..." with cancelled blocks

## Testing
- Build successful: ✓
- Bundle size: 16.8 kB (unchanged)
- No type errors or warnings

## Related Files
- `app/scheduler/page.tsx` - Message display logic
- `DEPLOY_COUNTER_WITH_SELECTED_BLOCK.sql` - Backend function (ensures correct care_response_id)
