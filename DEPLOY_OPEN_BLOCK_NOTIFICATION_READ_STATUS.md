# Open Block Notification Read Status - Deployment Guide

## Overview
Fixed the message counter and notification system for open block acceptances. When a parent accepts an open block invitation, the provider (parent who sent the invitation) now:
1. Sees the message counter increment
2. Can view the acceptance notification in the Messages page with block details (date/time)
3. Can click to expand and see "View in Calendar" button
4. Can mark the notification as read by clicking/expanding it

## Problems Fixed
- Open block acceptance notifications (`care_response` type) were created but not counted or displayed
- Notifications remained unread in the database even after being viewed
- Provider had no visual indication that their open block was accepted
- Notification messages had no date/time details showing which block was accepted
- No way to navigate to the accepted block in the calendar

## Files Modified

### 1. `app/components/Header.tsx`
**Lines 178-188**: Added query to fetch unread notifications
```typescript
// Get unread notifications (for open block acceptances, etc.)
const { data: unreadNotifications, error: notificationsError } = await supabase
  .from('notifications')
  .select('*')
  .eq('user_id', userId)
  .eq('is_read', false)
  .in('type', ['care_response', 'open_block_provider_notified']);
```

**Lines 271-274**: Added notifications to counter
```typescript
// Count unread notifications (open block acceptances, etc.)
if (unreadNotifications) {
  unreadCount += unreadNotifications.length;
}
```

### 2. `app/scheduler/page.tsx`
**Line 1962**: Updated notification query to include open block types
```typescript
.in('type', ['reschedule_accepted', 'reschedule_declined', 'reschedule_counter_sent', 'reschedule_counter_accepted', 'reschedule_counter_declined', 'care_response', 'open_block_provider_notified'])
```

**Lines 638-656**: Added subtitle with block date/time details
```typescript
// Build subtitle with date/time info if available
let subtitle = '';
if (notification.type === 'care_response' && notification.data?.existing_block_date) {
  // This is an open block acceptance notification
  const date = formatDateOnly(notification.data.existing_block_date);
  const startTime = notification.data.existing_block_start_time?.substring(0, 5) || '';
  const endTime = notification.data.existing_block_end_time?.substring(0, 5) || '';
  subtitle = `${date} ${startTime}-${endTime}`;
}

messages.push({
  id: `reschedule-notification-${notification.id}`,
  type: notification.type as 'reschedule_accepted' | 'reschedule_declined' | 'reschedule_counter_sent' | 'reschedule_counter_accepted' | 'reschedule_counter_declined' | 'care_response',
  title: notification.title,
  subtitle: subtitle,
  timestamp: notification.created_at,
  data: notification.data,
  actions: actions
});
```

**Lines 1319-1340**: Added expanded content section for open block acceptance
```typescript
{/* Show open block acceptance details (when notification type is care_response but for open block) */}
{message.type === 'care_response' && !message.data.responses && message.data.existing_block_date && (
  <div className="space-y-3 mb-4">
    <div className="bg-green-50 rounded-lg p-3 border-l-4 border-green-500">
      <div className="flex-1">
        <p className="font-medium text-gray-900 text-sm">
          Care Block Accepted
        </p>
        <p className="text-sm text-gray-600 mt-1">
          {formatDateOnly(message.data.existing_block_date)} from{' '}
          {message.data.existing_block_start_time?.substring(0, 5)} to {message.data.existing_block_end_time?.substring(0, 5)}
        </p>
        <button
          onClick={() => navigateToCareBlock(message.data.existing_block_date, 'provided')}
          className="inline-block mt-3 px-4 py-2 bg-green-600 text-white text-sm rounded hover:bg-green-700 transition-colors"
        >
          View in Calendar
        </button>
      </div>
    </div>
  </div>
)}
```

**Lines 3333-3338**: Added reschedule notifications to unread messages initialization
```typescript
// Check reschedule notifications (only unread ones)
rescheduleNotifications.forEach((notification) => {
  if (!notification.is_read) {
    pendingMessages.add(`reschedule-notification-${notification.id}`);
  }
});
```

**Line 3400**: Updated useEffect dependency array
```typescript
}, [careRequests, careResponses, invitations, rescheduleNotifications]);
```

**Lines 3338-3361**: Fixed `hasPendingActions` to handle open block notifications
```typescript
const hasPendingActions = (message: any) => {
  if (message.type === 'open_block_invitation') {
    return message.data.status === 'pending';
  }
  if (message.type === 'care_request') {
    return true; // Always unread until responded to
  }
  if (message.type === 'care_response') {
    // For open block acceptance notifications (no responses array)
    if (!message.data.responses && message.data.existing_block_date) {
      return false; // No pending actions - just an informational notification
    }
    // For regular care responses with multiple responses
    return message.data.responses?.some((r: any) => r.status === 'submitted') || false;
  }
  if (message.type === 'group_invitation') {
    return message.data.status === 'pending'; // Only unread if pending (not accepted or rejected)
  }
  if (message.type === 'event_invitation') {
    return true; // Always unread until RSVP is submitted
  }
  return false;
};
```

**Lines 3305-3343**: Enhanced `markMessageAsRead` to update database and state
```typescript
const markMessageAsRead = async (messageId: string) => {
  setUnreadMessages(prev => {
    const newUnread = new Set(prev);
    newUnread.delete(messageId);

    // Update localStorage for persistence
    localStorage.setItem('schedulerUnreadMessages', JSON.stringify(Array.from(newUnread)));

    // Update Header's unread count via localStorage
    const headerUnreadCount = newUnread.size;
    localStorage.setItem('headerSchedulerUnreadCount', headerUnreadCount.toString());

    // Dispatch event to notify Header component
    window.dispatchEvent(new Event('schedulerUpdated'));

    return newUnread;
  });

  // If this is a reschedule notification, mark it as read in the database
  if (messageId.startsWith('reschedule-notification-')) {
    const notificationId = messageId.replace('reschedule-notification-', '');
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', notificationId);

      if (!error) {
        // Update the local rescheduleNotifications state to reflect the change
        setRescheduleNotifications(prev =>
          prev.map(n => n.id === notificationId ? { ...n, is_read: true } : n)
        );
      }
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  }
};
```

## How It Works

### When Open Block Is Accepted:
1. `accept_open_block_invitation` SQL function creates notification with type `'care_response'`
2. Notification is stored with `is_read: false`

### On Provider's Side:
1. **Header Component**:
   - Fetches unread notifications of type `'care_response'` and `'open_block_provider_notified'`
   - Counts them in the message badge
   - Shows red counter badge with number

2. **Scheduler Page**:
   - Fetches same notifications when loading Messages
   - Displays them in the messages list
   - Adds them to `unreadMessages` set if `is_read = false`

3. **When User Clicks/Expands**:
   - `markMessageAsRead` is called
   - Removes from `unreadMessages` set (updates UI immediately)
   - Updates localStorage (persists across page refreshes)
   - Updates notification in database (`is_read: true`)
   - Dispatches event to update Header counter

## Testing Checklist

- [ ] Create an open block invitation and send to another parent
- [ ] Accept the invitation as the other parent
- [ ] Verify the provider sees message counter increment by 1
- [ ] Click on Messages page
- [ ] Verify the acceptance notification appears in the list
- [ ] Click/expand the notification
- [ ] Verify the counter decreases by 1
- [ ] Refresh the page
- [ ] Verify the notification remains marked as read
- [ ] Check database: notification's `is_read` should be `true`

## Database Changes
No SQL migrations required. The `notifications` table already has the `is_read` boolean column.

## Deployment Steps

1. Deploy to Vercel:
   ```bash
   git add .
   git commit -m "Fix: Open block notifications now show in message counter and can be marked as read"
   git push
   ```

2. Verify in production:
   - Test the complete flow described in Testing Checklist
   - Check browser console for any errors
   - Verify database updates are happening

## Rollback Plan
If issues occur:
1. Revert `app/components/Header.tsx` lines 178-188 and 271-274
2. Revert `app/scheduler/page.tsx` changes to lines 1962, 3273-3303, 3333-3338, 3400
3. Redeploy to Vercel

## Build Status
✓ Build successful with all changes
✓ No TypeScript errors
✓ No linting errors

## Notes
- Notifications are marked as read individually when clicked/expanded
- The read status persists in both localStorage and database
- Header counter automatically updates via event dispatching
- This fix also applies to any future `'care_response'` type notifications
