# How to Apply the Reschedule Workflow Fix

## Quick Summary
The fix ensures that **ALL parents** with children participating in a time block are notified of reschedule requests, not just those with reciprocal care agreements. When parents decline, only their specific reciprocal care block with the requester is cancelled, maintaining balance in the scheduling system.

## Step-by-Step Instructions

### 1. Access Supabase SQL Editor
1. Go to your Supabase dashboard
2. Navigate to the **SQL Editor** tab
3. Click **"New Query"**

### 2. Run the Complete SQL Script
1. Copy the entire contents of `RESCHEDULE_WORKFLOW_SQL_SCRIPTS.sql`
2. Paste it into the SQL Editor
3. Click **"Run"** to execute all the scripts

### 3. Verify the Changes
After running the scripts, you should see:
- ✅ `notifications` table created (if it didn't exist)
- ✅ `care_reschedule_requests` table created (if it didn't exist)
- ✅ New columns added to existing tables
- ✅ New functions created:
  - `create_reschedule_notifications`
  - `handle_reschedule_response_complete`
  - `get_reschedule_request_details`
  - `mark_notification_read`
  - `mark_all_notifications_read`

## What This Fix Does

### Before (Problem):
- Only parents with `care_type = 'needed'` blocks were notified
- Parents who accepted open block invitations were excluded
- When parents declined, all their care agreements were cancelled

### After (Solution):
- **ALL parents** with children in the time block are notified
- Includes reciprocal care participants AND open block acceptors
- When parents decline, only their specific reciprocal care block with the requester is cancelled
- Other care agreements remain intact to maintain scheduling balance

## Key Functions Created

### 1. `create_reschedule_notifications`
- Finds ALL parents with children in the time block
- Sends notifications to everyone (not just reciprocal care parents)
- Includes detailed information about the reschedule request

### 2. `handle_reschedule_response_complete`
- Handles accept/decline responses properly
- Creates new care blocks for accepted reschedules
- Cancels only specific reciprocal blocks for declined reschedules
- Maintains scheduling balance

### 3. `get_reschedule_request_details`
- Provides comprehensive data for the UI
- Shows all participating parents and their response status
- Returns structured JSON for easy frontend consumption

## Testing the Fix

### Test Scenario 1: Basic Reciprocal Care
1. Parent A has reciprocal care with Parent B
2. Parent A requests reschedule
3. ✅ Parent B should be notified
4. ✅ Parent B can accept/decline
5. ✅ Calendar updates correctly

### Test Scenario 2: Open Block with Multiple Parents
1. Parent A opens block, Parent B and Parent C accept
2. Parent A requests reschedule
3. ✅ Both Parent B and Parent C should be notified
4. ✅ Each can independently accept/decline
5. ✅ Calendar updates progressively

### Test Scenario 3: Mixed Participation
1. Parent A has reciprocal care with Parent B
2. Parent A opens block, Parent C accepts
3. Parent A requests reschedule
4. ✅ Both Parent B and Parent C should be notified
5. ✅ Different response combinations work correctly

## Frontend Integration

The frontend components are already updated:
- `RescheduleModal.tsx` - Updated to work with new notification system
- `RescheduleResponseModal.tsx` - New component for handling parent responses

## Important Notes

1. **Scheduling Balance**: When a parent declines, only their specific reciprocal care block with the requester is cancelled. Other care agreements remain intact.

2. **Progressive Updates**: Calendars update as parents respond, not all at once.

3. **Complete Coverage**: All participating parents are now notified, regardless of how they became involved in the time block.

4. **Audit Trail**: All actions are properly tracked with action_type and timestamps.

## Rollback (if needed)

If you need to rollback these changes:
1. The functions can be dropped individually
2. The new columns can be removed
3. The new tables can be dropped
4. All changes are additive and don't modify existing data

## Support

If you encounter any issues:
1. Check the Supabase logs for error messages
2. Verify all tables and columns exist
3. Test with a simple reschedule request first
4. Check that the notification system is working

The fix is designed to be backward compatible and won't affect existing functionality.
