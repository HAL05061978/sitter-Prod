# Reschedule Counter Fixes Summary

## Issues Fixed

### 1. Reschedule Request Received - Messages Button Not Updating ✅
**Problem**: When a user receives a reschedule request, the Messages button counter doesn't update immediately.

**Root Cause**: The Header wasn't subscribed to real-time notifications table changes.

**Fix**: Added real-time subscription to notifications table in `Header.tsx` (lines 557-583):
```typescript
useEffect(() => {
  if (!user) return;

  const channel = supabase
    .channel('header_notifications_updates')
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'notifications',
      filter: `user_id=eq.${user.id}`
    }, (payload) => {
      console.log('📬 New notification received:', payload.new);
      // Refresh counters when new notification is inserted
      fetchSchedulerMessagesCount(user.id);
      fetchNewCalendarBlocksCount(user.id);
    })
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}, [user]);
```

**Result**: Now when a reschedule request notification is inserted, the Messages button counter updates in real-time.

---

### 2. Reschedule Counter Received - Messages Button Not Updating ✅
**Problem**: Same as #1 - counter proposals didn't update Messages button.

**Root Cause**: Same as #1 - no real-time subscription.

**Fix**: Same subscription fixes this issue too (line 574 in Header.tsx calls `fetchSchedulerMessagesCount`).

**Result**: Counter proposals now trigger immediate Messages button update.

---

### 3. Accepting Reschedule - Calendar Button Not Updating ✅
**Problem**: When accepting a reschedule request, the Calendar button counter doesn't update.

**Root Cause**: The `handleRescheduleResponse` function didn't update the calendar counter or dispatch events.

**Fix**: Updated `scheduler/page.tsx` (lines 2279-2291):
```typescript
if (data.success) {
  // If accepting, update calendar counter
  if (response === 'accepted') {
    // Reschedule acceptance modifies 2 existing blocks (doesn't create new ones)
    // So we add +2 to indicate calendar was updated
    const currentCalendarCount = parseInt(localStorage.getItem('newCalendarBlocksCount') || '0', 10);
    localStorage.setItem('newCalendarBlocksCount', (currentCalendarCount + 2).toString());

    // Dispatch calendar counter update event
    window.dispatchEvent(new Event('calendarCountUpdated'));
  }

  // Dispatch scheduler counter update event (to decrement Messages button)
  window.dispatchEvent(new Event('schedulerCountUpdated'));

  showAlertOnce(`Successfully ${response} the reschedule request.`);
  // Refresh all data
  await fetchData();
}
```

**Result**: Calendar counter now shows +2 when accepting a reschedule (indicating 2 blocks were modified).

---

### 4. Accepting Reschedule Counter - Calendar Button Not Updating ✅
**Problem**: Same as #3 - accepting a counter proposal didn't update calendar.

**Root Cause**: Same as #3 - same code path handles both regular reschedules and counter proposals.

**Fix**: Same fix as #3 (the response === 'accepted' check works for both).

**Result**: Accepting counter proposals now updates calendar counter.

---

## How It All Works Together

### Receiving Notifications (Real-Time)
1. Backend function creates notification in database
2. Supabase real-time subscription triggers in Header
3. Header calls `fetchSchedulerMessagesCount()` and `fetchNewCalendarBlocksCount()`
4. Messages button counter updates immediately
5. Calendar button counter updates immediately (if notification has `blocks_created` field)

### Accepting/Declining Actions (Manual)
1. User clicks Accept/Decline button
2. `handleRescheduleResponse` is called
3. Backend function processes the response
4. Frontend updates localStorage calendar counter (+2 for acceptance)
5. Frontend dispatches `calendarCountUpdated` event
6. Frontend dispatches `schedulerCountUpdated` event
7. Header listens to these events and refreshes counters
8. Both button counters update immediately

## Testing Checklist

- [x] Send reschedule request → Receiver sees Messages button counter increment
- [x] Send reschedule counter → Receiver sees Messages button counter increment
- [x] Accept reschedule request → Calendar button shows +2, Messages button decrements
- [x] Accept reschedule counter → Calendar button shows +2, Messages button decrements
- [x] Decline reschedule request → Messages button decrements
- [x] Decline reschedule counter → Messages button decrements

## Files Modified

1. **app/components/Header.tsx**
   - Added real-time subscription to notifications table (lines 557-583)

2. **app/scheduler/page.tsx**
   - Added calendar counter update when accepting reschedule (lines 2279-2291)
   - Added event dispatches for counter updates

## Notes

- Reschedule acceptance modifies 2 existing blocks (doesn't create new ones)
- Calendar counter +2 indicates "these blocks were updated, check your calendar"
- The counter clears after viewing the calendar for 2 seconds
- All changes are backward compatible
