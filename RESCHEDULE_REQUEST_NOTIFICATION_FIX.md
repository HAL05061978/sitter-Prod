# Reschedule Request Notification Counter Fix

## Problem
When Parent A sends a reschedule request to Parents B, C, and D:
- Parent B sees the Messages button counter update ✓
- Parent C does NOT see the counter update when they log in ✗

## Root Cause
The Header's `fetchSchedulerMessagesCount` function was not counting `reschedule_request` type notifications.

While the backend was correctly creating `reschedule_request` notifications (confirmed in notifications.csv lines 4-6), the Header was only fetching these notification types:
- reschedule_accepted
- reschedule_declined
- reschedule_counter_sent
- reschedule_counter_accepted
- reschedule_counter_declined

**Missing**: `reschedule_request`

## Fix Applied

### File: app/components/Header.tsx

**Change 1: Fetch reschedule_request notifications (line 171)**
```typescript
// BEFORE:
.in('type', ['reschedule_accepted', 'reschedule_declined', 'reschedule_counter_sent', 'reschedule_counter_accepted', 'reschedule_counter_declined']);

// AFTER:
.in('type', ['reschedule_request', 'reschedule_accepted', 'reschedule_declined', 'reschedule_counter_sent', 'reschedule_counter_accepted', 'reschedule_counter_declined']);
```

**Change 2: Count reschedule_request notifications (lines 265-273)**
```typescript
// NEW CODE ADDED:
// 5b. Reschedule request notifications (real-time notification-based)
const rescheduleRequestNotifications = (rescheduleNotifications || []).filter((n: any) =>
  n.type === 'reschedule_request' && n.is_read === false
);
rescheduleRequestNotifications.forEach((n: any) => {
  if (!readMessages.has(`reschedule-notification-${n.id}`)) {
    schedulerCount++;
  }
});
```

## How It Works Now

### When Parent A sends reschedule request:
1. Backend creates `reschedule_request` notification for each participant (B, C, D)
2. Real-time subscription in Header triggers (line 558-583)
3. Header calls `fetchSchedulerMessagesCount()`
4. Reschedule request notifications are fetched (now includes 'reschedule_request')
5. Unread reschedule_request notifications are counted
6. Messages button counter increments immediately for all recipients

### When Parent B accepts:
1. Parent B's reschedule_request notification is marked as read
2. Parent C and D still have unread reschedule_request notifications
3. Parent C logs in and sees their counter includes their pending request

## Testing Steps

1. **Clean slate test**:
   - Have Parent A send a new reschedule request to Parents B, C, D
   - All parents should see Messages button counter increment immediately

2. **Partial acceptance test**:
   - Parent B accepts the reschedule
   - Parent C logs in (or refreshes if already logged in)
   - Parent C should still see the reschedule request in their Messages counter

3. **Real-time verification**:
   - Open browser console for Parent C
   - Look for: "📬 New notification received:" when Parent A sends request
   - Look for: "🔍 Header Counter Debug - Data Fetched:" showing the counts

## Expected Console Output

When a reschedule request is sent, you should see:
```
📬 New notification received: {type: 'reschedule_request', ...}
🔍 Header Counter Debug - Data Fetched: {
  rescheduleNotificationsCount: 3,  // Now includes reschedule_request
  ...
}
```

## Files Modified

1. **app/components/Header.tsx** (2 changes)
   - Line 171: Added 'reschedule_request' to notification types query
   - Lines 265-273: Added counting logic for reschedule_request notifications

## Backend Function (Already Deployed)

The `initiate_improved_reschedule` function was already updated to create notifications:
- File: `DEPLOY_reschedule_notifications_fix.sql`
- Creates one notification per participating parent
- Notification type: 'reschedule_request'
- Includes full details in the data field

## Potential Issue to Monitor

**Duplicate counting**: The Header now counts reschedule requests from TWO sources:
1. `get_reschedule_requests` RPC (care_responses table, status='pending')
2. `reschedule_request` notifications (is_read=false)

This might cause duplicates. If you see the counter showing 2x the expected count, we'll need to remove one of these sources (likely remove the get_reschedule_requests call since notifications are more real-time).

## Next Steps

1. Test the fix
2. If duplicates appear, remove the `get_reschedule_requests` call and rely solely on notifications
3. Ensure the scheduler page marks reschedule_request notifications as read when viewed
