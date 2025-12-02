# Counter-Proposal Notifications - Complete Implementation Summary

## Overview
Phase 2 now includes COMPLETE reschedule notification coverage:
1. ✅ Simple reschedule acceptance (Phase 1)
2. ✅ Simple reschedule decline (Phase 2)
3. ✅ Counter-proposal sent (Phase 2 - NEW)
4. ✅ Counter-proposal accepted (Phase 2 - NEW)
5. ✅ Counter-proposal declined (Phase 2 - NEW)

## Counter-Proposal Workflow

### Scenario Example:
1. **Parent A (Rosmary)** sends reschedule request: Nov 3 → Nov 10
2. **Parent B (Bruce)** declines with counter-proposal: Offers Nov 12 instead
3. **Parent A** can then:
   - **Accept counter**: New block created at Nov 12
   - **Decline counter**: Same as if Bruce declined initially (2 blocks removed)

## Backend Changes (SQL)

### New Notification Types Added:
- `reschedule_counter_sent`
- `reschedule_counter_accepted`
- `reschedule_counter_declined`

### 1. Counter-Proposal Sent (Lines 725-786)

**When:** Parent B declines original reschedule and sends counter-proposal

**Notifications Created:**
```sql
-- For Parent A (original requester, now receiving counter)
Title: "Bruce sent a counter-proposal for Nov 3, 2025"
Data:
  - original_date: Nov 3 (yellow block date)
  - original_requested_date: Nov 10 (what Parent A originally wanted)
  - counter_date: Nov 12 (Bruce's counter-proposal)
  - counter_request_id: UUID of new counter request

-- For Parent B (counter-proposer)
Title: "You sent a counter-proposal to Rosmary for Nov 3, 2025"
Data: (same fields)
```

### 2. Counter-Proposal Accepted (Lines 472-539)

**When:** Parent A accepts Parent B's counter-proposal

**Notifications Created:**
```sql
-- For Parent B (counter-proposer)
Title: "Rosmary accepted your counter-proposal for Nov 3, 2025"
Data:
  - original_date: Nov 3
  - new_date: Nov 12 (accepted counter date)
  - new_start_time, new_end_time

-- For Parent A (acceptor)
Title: "You accepted Bruce's counter-proposal for Nov 3, 2025"
Data: (same fields)
```

### 3. Counter-Proposal Declined (Lines 738-850)

**When:** Parent A declines Parent B's counter-proposal

**Notifications Created:**
```sql
-- For Parent B (counter-proposer)
Title: "Rosmary declined your counter-proposal for Nov 3, 2025"
Data:
  - original_date: Nov 3
  - declined_counter_date: Nov 12 (the declined counter)
  - selected_cancellation_date: (block Bruce selected to remove)
  - Includes CASE statement for open_block handling

-- For Parent A (decliner)
Title: "You declined Bruce's counter-proposal for Nov 3, 2025"
Data: (same fields)
```

## Frontend Updates Needed

### 1. Update Type Definitions (app/scheduler/page.tsx)

**Line 464** - Add new message types:
```typescript
type: 'open_block_invitation' | 'care_request' | 'care_response' | 'care_accepted' |
      'care_declined' | 'open_block_accepted' | 'group_invitation' | 'event_invitation' |
      'reschedule_request' | 'reschedule_accepted' | 'reschedule_declined' |
      'reschedule_counter_sent' | 'reschedule_counter_accepted' | 'reschedule_counter_declined';
```

### 2. Add State Variable

**After line 354:**
```typescript
const [counterProposalNotifications, setCounterProposalNotifications] = useState<any[]>([]);
```

### 3. Fetch Counter Notifications

**In fetchData function, after line 1694:**
```typescript
// Fetch counter-proposal notifications
const { data: counterNotifications, error: counterNotificationsError } = await supabase
  .from('notifications')
  .select('*')
  .eq('user_id', user.id)
  .in('type', ['reschedule_counter_sent', 'reschedule_counter_accepted', 'reschedule_counter_declined'])
  .order('created_at', { ascending: false });

if (counterNotificationsError) {
  console.error('Error fetching counter notifications:', counterNotificationsError);
} else {
  setCounterProposalNotifications(counterNotifications || []);
}
```

### 4. Add to Messages List

**In getAllMessages function:**
```typescript
// Add counter-proposal notifications
counterProposalNotifications.forEach((notification) => {
  messages.push({
    id: `counter-notification-${notification.id}`,
    type: notification.type as 'reschedule_counter_sent' | 'reschedule_counter_accepted' | 'reschedule_counter_declined',
    title: notification.title,
    subtitle: '',
    timestamp: notification.created_at,
    data: notification.data,
    actions: notification.type === 'reschedule_counter_sent' ? (
      <div className="flex space-x-2 mt-2">
        <button className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700">
          Accept
        </button>
        <button className="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700">
          Decline
        </button>
      </div>
    ) : undefined
  });
});
```

### 5. Add Badge Styling

**Around lines 925-944:**
```typescript
message.type === 'reschedule_counter_sent' ? 'bg-yellow-100 text-yellow-800' :
message.type === 'reschedule_counter_accepted' ? 'bg-green-100 text-green-800' :
message.type === 'reschedule_counter_declined' ? 'bg-red-100 text-red-800' :
// ...
message.type === 'reschedule_counter_sent' ? 'Counter Sent' :
message.type === 'reschedule_counter_accepted' ? 'Accepted' :
message.type === 'reschedule_counter_declined' ? 'Declined' :
```

### 6. Add Expanded Views

**After reschedule_declined section (~line 1365):**

```typescript
{/* Show counter-proposal sent details */}
{message.type === 'reschedule_counter_sent' && (
  <div className="space-y-3 mb-4">
    <h5 className="font-medium text-gray-900 text-sm">Counter-proposal details:</h5>

    <div className="bg-yellow-50 rounded-lg p-3 border-l-4 border-yellow-500">
      <div className="flex-1">
        <p className="font-medium text-gray-900 text-sm">
          Original request
        </p>
        <p className="text-sm text-gray-600 mt-1">
          {formatDateOnly(message.data.original_requested_date)} from{' '}
          {formatTime(message.data.original_requested_start_time)} to {formatTime(message.data.original_requested_end_time)}
        </p>
      </div>
    </div>

    <div className="bg-blue-50 rounded-lg p-3 border-l-4 border-blue-500">
      <div className="flex-1">
        <p className="font-medium text-gray-900 text-sm">
          Counter-proposal
        </p>
        <p className="text-sm text-gray-600 mt-1">
          {formatDateOnly(message.data.counter_date)} from{' '}
          {formatTime(message.data.counter_start_time)} to {formatTime(message.data.counter_end_time)}
        </p>
      </div>
    </div>
  </div>
)}

{/* Show counter-proposal accepted details */}
{message.type === 'reschedule_counter_accepted' && (
  <div className="space-y-3 mb-4">
    <div className="bg-blue-50 rounded-lg p-3 border-l-4 border-blue-500">
      <div className="flex-1">
        <p className="font-medium text-gray-900 text-sm">
          New care block (receiving care)
        </p>
        <p className="text-sm text-gray-600 mt-1">
          {formatDateOnly(message.data.new_date)} from{' '}
          {formatTime(message.data.new_start_time)} to {formatTime(message.data.new_end_time)}
        </p>
        <button
          onClick={() => navigateToCareBlock(message.data.new_date, 'needed')}
          className="inline-block mt-3 px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors"
        >
          View in Calendar
        </button>
      </div>
    </div>
  </div>
)}

{/* Show counter-proposal declined details */}
{message.type === 'reschedule_counter_declined' && (
  <div className="space-y-3 mb-4">
    <h5 className="font-medium text-gray-900 text-sm">Cancelled care blocks:</h5>

    {/* Declined counter */}
    <div className="bg-red-50 rounded-lg p-3 border-l-4 border-red-500">
      <div className="flex-1">
        <p className="font-medium text-gray-900 text-sm">
          Declined counter-proposal
        </p>
        <p className="text-sm text-gray-600 mt-1">
          {formatDateOnly(message.data.declined_counter_date)} from{' '}
          {formatTime(message.data.declined_counter_start_time)} to {formatTime(message.data.declined_counter_end_time)}
        </p>
      </div>
    </div>

    {/* Selected cancellation */}
    {message.data.selected_cancellation_date && (
      <div className="bg-red-50 rounded-lg p-3 border-l-4 border-red-500">
        <div className="flex-1">
          <p className="font-medium text-gray-900 text-sm">
            Selected arrangement removed
          </p>
          <p className="text-sm text-gray-600 mt-1">
            {formatDateOnly(message.data.selected_cancellation_date)} from{' '}
            {formatTime(message.data.selected_cancellation_start_time)} to {formatTime(message.data.selected_cancellation_end_time)}
          </p>
        </div>
      </div>
    )}
  </div>
)}
```

## What Users Will See

### Counter Sent:
**Title:** "Bruce sent a counter-proposal for Nov 3, 2025"
**Badge:** Yellow "Counter Sent"
**Actions:** Accept / Decline buttons
**Expanded:** Shows original request (Nov 10) and counter-proposal (Nov 12)

### Counter Accepted:
**Title:** "Rosmary accepted your counter-proposal for Nov 3, 2025"
**Badge:** Green "Accepted"
**Expanded:** Blue block showing new care date with "View in Calendar" button

### Counter Declined:
**Title:** "Rosmary declined your counter-proposal for Nov 3, 2025"
**Badge:** Red "Declined"
**Expanded:** Two red blocks - declined counter and selected cancellation

## Files to Update

1. ✅ `DEPLOY_RESCHEDULE_DECLINE_NOTIFICATIONS_PHASE2.sql` - Backend complete
2. ⏳ `app/scheduler/page.tsx` - Frontend updates needed
3. ⏳ Build and test

## Testing Checklist

- [ ] Deploy SQL to production
- [ ] Test counter-proposal sent: Both parties receive notification
- [ ] Test counter-proposal accepted: Both parties receive notification, blue block shows
- [ ] Test counter-proposal declined: Both parties receive notification, both blocks shown
- [ ] Verify CASE statement works for open_block cancellations
- [ ] Verify Accept/Decline buttons work on counter sent message
- [ ] Verify color coding (Yellow=sent, Green=accepted, Red=declined)
