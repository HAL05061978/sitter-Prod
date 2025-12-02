# Phase 2 Deployment Summary: Reschedule Decline Notifications (UPDATED)

## Overview
This deployment adds complete decline notifications showing **both cancelled blocks** when a parent declines a reschedule request:
1. **The declined reschedule block** - The date/time that was proposed for the reschedule
2. **The selected cancellation block** - The existing arrangement the decliner chose to remove

## What Users Will See

### When Expanding a Decline Message:

Both parties will see TWO red-bordered blocks:

**Block 1: Declined Reschedule**
- Label: "Declined reschedule"
- Shows the date/time that was requested to be rescheduled TO
- Example: "Nov 5, 2025 from 9:00 AM to 12:00 PM"

**Block 2: Selected Arrangement Removed**
- Label: "Selected arrangement removed"
- Shows the existing care block that the decliner selected to cancel
- Example: "Nov 10, 2025 from 2:00 PM to 5:00 PM"

This gives both parties complete visibility into:
- What reschedule was declined
- What existing arrangement was sacrificed/removed

## Backend Changes (SQL)

### Data Structure in Notifications

```json
{
  "requester_id": "uuid",
  "responder_id": "uuid",
  "responder_name": "John Doe",
  "declined_reschedule_date": "2025-11-05",
  "declined_reschedule_start_time": "09:00:00",
  "declined_reschedule_end_time": "12:00:00",
  "selected_cancellation_date": "2025-11-10",
  "selected_cancellation_start_time": "14:00:00",
  "selected_cancellation_end_time": "17:00:00",
  "selected_cancellation_request_id": "uuid",
  "care_response_id": "uuid"
}
```

### SQL Implementation

The notification queries the `care_requests` table to get the selected cancellation details:

```sql
'selected_cancellation_date', (
    SELECT requested_date FROM care_requests
    WHERE id = p_selected_cancellation_request_id
),
'selected_cancellation_start_time', (
    SELECT start_time FROM care_requests
    WHERE id = p_selected_cancellation_request_id
),
'selected_cancellation_end_time', (
    SELECT end_time FROM care_requests
    WHERE id = p_selected_cancellation_request_id
)
```

## Frontend Changes

### Display Logic (app/scheduler/page.tsx lines 1333-1365)

```typescript
{/* Show declined reschedule details */}
{message.type === 'reschedule_declined' && (
  <div className="space-y-3 mb-4">
    <h5 className="font-medium text-gray-900 text-sm">Cancelled care blocks:</h5>

    {/* Block 1: The reschedule request that was declined */}
    <div className="bg-red-50 rounded-lg p-3 border-l-4 border-red-500">
      <div className="flex-1">
        <p className="font-medium text-gray-900 text-sm">
          Declined reschedule
        </p>
        <p className="text-sm text-gray-600 mt-1">
          {formatDateOnly(message.data.declined_reschedule_date)} from{' '}
          {formatTime(message.data.declined_reschedule_start_time)} to
          {formatTime(message.data.declined_reschedule_end_time)}
        </p>
      </div>
    </div>

    {/* Block 2: The existing arrangement that was selected to be removed */}
    {message.data.selected_cancellation_date && (
      <div className="bg-red-50 rounded-lg p-3 border-l-4 border-red-500">
        <div className="flex-1">
          <p className="font-medium text-gray-900 text-sm">
            Selected arrangement removed
          </p>
          <p className="text-sm text-gray-600 mt-1">
            {formatDateOnly(message.data.selected_cancellation_date)} from{' '}
            {formatTime(message.data.selected_cancellation_start_time)} to
            {formatTime(message.data.selected_cancellation_end_time)}
          </p>
        </div>
      </div>
    )}
  </div>
)}
```

### Conditional Display
- Block 2 only shows if `selected_cancellation_date` exists
- This handles cases where a decline might not have a selected cancellation

## Example User Experience

### Scenario:
- **Original block:** Nov 3, 2025, 1:00 PM - 4:00 PM (yellow - being rescheduled FROM)
- **Requested reschedule TO:** Nov 5, 2025, 9:00 AM - 12:00 PM
- **Existing arrangement:** Nov 10, 2025, 2:00 PM - 5:00 PM
- **Action:** Parent declines reschedule and selects Nov 10 arrangement to remove

### What Requester Sees:
**Title:** "Mary declined your reschedule request for Nov 3, 2025"

**When Expanded:**
```
Cancelled care blocks:

┌─────────────────────────────────┐
│ Declined reschedule             │
│ Nov 5, 2025 from 9:00 AM to    │
│ 12:00 PM                        │
└─────────────────────────────────┘

┌─────────────────────────────────┐
│ Selected arrangement removed    │
│ Nov 10, 2025 from 2:00 PM to   │
│ 5:00 PM                         │
└─────────────────────────────────┘
```

### What Decliner Sees:
**Title:** "You declined John's reschedule request for Nov 3, 2025"

**Same expanded view** showing both cancelled blocks

## Technical Details

### Data Flow:
1. Parent declines reschedule via frontend
2. Frontend passes `p_selected_cancellation_request_id` to SQL function
3. SQL function:
   - Cancels the blocks (existing logic)
   - Queries care_requests for selected cancellation details
   - Creates notifications with both block details
4. Frontend queries notifications and displays both blocks

### Safety:
- Notifications created AFTER successful block operations
- Inline subqueries avoid variable scope issues
- Conditional display handles missing selected cancellation
- All existing logic preserved (972 lines)

## Testing Checklist

- [ ] Deploy SQL to production
- [ ] Test decline with selected cancellation: Both blocks show
- [ ] Test decline without selected cancellation: Only declined reschedule shows
- [ ] Verify requester sees both blocks
- [ ] Verify decliner sees both blocks
- [ ] Verify correct dates/times for both blocks
- [ ] Verify expandable view works
- [ ] Verify acceptance notifications still work (Phase 1)

## Files in This Deployment

1. `DEPLOY_RESCHEDULE_DECLINE_NOTIFICATIONS_PHASE2.sql` - Backend SQL (updated)
2. `app/scheduler/page.tsx` - Frontend updates (built successfully)
3. `DEPLOY_PHASE2_UPDATED_SUMMARY.md` - This summary

## Build Status
✅ Build successful - no errors
