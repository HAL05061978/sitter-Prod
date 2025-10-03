# Calendar Display Update for Rescheduled Blocks

## Current Issue
The original block is being marked as `cancelled` and not showing on the calendar. It should be marked as `rescheduled` and displayed in orange.

## Solution

### 1. Database Changes
- Change `action_type` from `'cancelled'` to `'rescheduled'`
- Keep `status` as `'pending'` so it shows on calendar
- All children remain in the block except Parent A's child

### 2. Calendar Display Logic
The calendar should display blocks with `action_type = 'rescheduled'` in orange color to indicate they are pending reschedule responses.

### 3. Expected Behavior
- **Original block**: Shows in orange with all children except Parent A's child
- **New block**: Shows in green with only Parent A's child
- **As parents respond**: Their children move from original to new block
- **When all respond**: Original block is deleted

## Implementation
Run `FIX_ORIGINAL_BLOCK_VISIBILITY.sql` to apply the database changes.

The calendar component should be updated to:
1. Display `action_type = 'rescheduled'` blocks in orange
2. Show appropriate status text like "Pending Reschedule"
3. Allow parents to respond to the reschedule request

## Color Coding
- **Green**: Normal providing care blocks (`action_type = 'new'`)
- **Blue**: Normal receiving care blocks (`action_type = 'new'`)
- **Orange**: Rescheduled blocks pending responses (`action_type = 'rescheduled'`)
- **Red**: Cancelled blocks (`action_type = 'cancelled'`)
