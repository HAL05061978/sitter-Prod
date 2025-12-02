# Reschedule Message - Update Badge Removed - Complete

## Change Made

Removed the "Update" badge from reschedule request messages so only the Accept and Decline buttons are displayed inline.

### Updated Badge Display (lines 900-931)

**Before:**
```typescript
<span className={`px-2 py-1 text-xs rounded-full ${...}`}>
  {message.type === 'reschedule_request' ? 'Update' : ...}
</span>
```

**After:**
```typescript
{/* Don't show badge for reschedule_request since buttons are inline */}
{message.type !== 'reschedule_request' && (
  <span className={`px-2 py-1 text-xs rounded-full ${...}`}>
    {message.type === ... ? ... : 'Update'}
  </span>
)}
```

**Impact:** The "Update" badge is no longer shown for reschedule messages

## Results

### Reschedule Message (Before):
```
Rosmary wants to reschedule Nov 3, 2025 care block
From Nov 3, 2025 16:00:00-17:00:00 to Nov 7, 2025 18:00:00-20:30:00
Nov 3, 2025                    [Update] [Accept] [Decline]
```

### Reschedule Message (After):
```
Rosmary wants to reschedule Nov 3, 2025 care block
From Nov 3, 2025 16:00:00-17:00:00 to Nov 7, 2025 18:00:00-20:30:00
Nov 3, 2025                            [Accept] [Decline]
```

## Benefits

1. **Cleaner UI** - Removed redundant "Update" badge
2. **Clear Actions** - Only action buttons are shown
3. **Better Focus** - Users' attention goes directly to Accept/Decline
4. **Consistency** - Matches the clean pattern of other inline action messages

## Build Status
✓ Build successful
✓ Scheduler bundle: 16.1 kB (maintained)
✓ No TypeScript errors
✓ All routes compiled successfully

---

## Next Step Required: Reschedule Acceptance/Decline Messages

### Current Situation
When a user accepts or declines a reschedule request, the calendars are updated correctly, but **no notification messages are created** to inform either party of the outcome.

### Required Implementation

#### Backend Changes Needed

The reschedule response handling (likely in a Supabase function called when Accept/Decline is clicked) needs to be updated to create notification messages similar to how open block and reciprocal acceptance messages are created.

#### Message Types to Add

**1. Reschedule Accepted (Requester's View)**
```
{Parent} accepted your reschedule request for Nov 3, 2025
Nov 7, 2025                                    [Accepted ▼]

  New care block
  Nov 7, 2025 from 18:00 to 20:30
  [View in Calendar]
```

**2. Reschedule Accepted (Responder's View)**
```
You accepted {Parent}'s reschedule request for Nov 3, 2025
Nov 7, 2025                                    [Accepted ▼]

  New care block
  Nov 7, 2025 from 18:00 to 20:30
  [View in Calendar]
```

**3. Reschedule Declined (Requester's View)**
```
{Parent} declined your reschedule request for Nov 3, 2025
Nov 3, 2025                                    [Declined]

(No expand, message is complete)
```

**4. Reschedule Declined (Responder's View)**
```
You declined {Parent}'s reschedule request for Nov 3, 2025
Nov 3, 2025                                    [Declined]

(No expand, message is complete)
```

#### Frontend Changes Needed

1. **Add new message types** (app/scheduler/page.tsx line 464):
   ```typescript
   type: 'open_block_invitation' | 'care_request' | 'care_response' | 'care_accepted' |
         'care_declined' | 'open_block_accepted' | 'group_invitation' | 'event_invitation' |
         'reschedule_request' | 'reschedule_accepted' | 'reschedule_declined';
   ```

2. **Add badge styling** for new types:
   ```typescript
   message.type === 'reschedule_accepted' ? 'bg-green-100 text-green-800' :
   message.type === 'reschedule_declined' ? 'bg-red-100 text-red-800' :
   ```

3. **Add badge labels**:
   ```typescript
   message.type === 'reschedule_accepted' ? 'Accepted' :
   message.type === 'reschedule_declined' ? 'Declined' :
   ```

4. **Add expanded view for reschedule_accepted** (similar to lines 1185-1231 for care_request):
   ```typescript
   {message.type === 'reschedule_accepted' && (
     <div className="space-y-3 mb-4">
       <div className="bg-green-50 rounded-lg p-3 border-l-4 border-green-500">
         <p className="font-medium text-gray-900 text-sm">New care block</p>
         <p className="text-sm text-gray-600 mt-1">
           {formatDateOnly(message.data.new_date)} from {formatTime(message.data.new_start_time)} to {formatTime(message.data.new_end_time)}
         </p>
         <button onClick={() => navigateToCareBlock(message.data.new_date, 'provided')}>
           View in Calendar
         </button>
       </div>
     </div>
   )}
   ```

5. **Disable expand for reschedule_declined** (similar to care_declined, line 875):
   ```typescript
   if (message.type === 'care_declined' || message.type === 'reschedule_request' || message.type === 'reschedule_declined') return;
   ```

#### Backend Function to Update

The function that handles reschedule responses (likely called from the RescheduleResponseModal component) needs to:

1. After successfully updating the care blocks in the database
2. Create notification records for both parties:
   - One for the requester (who initiated the reschedule)
   - One for the responder (who accepted/declined)
3. Include all necessary data fields:
   - `requester_name` / `responder_name`
   - `original_date`, `original_start_time`, `original_end_time`
   - `new_date`, `new_start_time`, `new_end_time`
   - `status` ('accepted' or 'declined')

### Pattern to Follow

Use the same pattern as open block acceptance notifications:
- See `MANUAL_DEPLOY_enhanced_open_block_notifications.sql` for reference
- Create messages for both parties involved
- Include all necessary data for displaying the new care block
- Follow the consistent title format: "{Name} accepted/declined your reschedule request for {Date}"

This will provide a complete notification experience matching the quality of open block and reciprocal care acceptances.
