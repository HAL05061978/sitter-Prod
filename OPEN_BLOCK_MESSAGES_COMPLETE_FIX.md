# Open Block Messages Complete Fix

## Problem Identified
The open block acceptance messages were missing reciprocal block data because the frontend was building messages from `care_responses` table queries, NOT from the `notifications` table.

The console showed message data included:
- `existing_block_date/time` ✓
- `open_block_parent_name` ✓
- `group_name` ✓
- But MISSING: `reciprocal_date`, `reciprocal_start_time`, `reciprocal_end_time` ✗

## Root Cause
In `app/scheduler/page.tsx`, the code was querying `care_responses` and `care_requests` to build open block messages, but wasn't fetching the reciprocal fields from `care_requests`.

## Solution Applied

### Changes Made (app/scheduler/page.tsx)

**1. Acceptor View (lines 2577-2588)**
Added reciprocal fields to the data returned for accepted open blocks:
```typescript
return {
  ...response,
  existing_block_date: request.requested_date,
  existing_block_start_time: request.start_time,
  existing_block_end_time: request.end_time,
  open_block_parent_name: requesterProfile?.full_name,
  provider_name: requesterProfile?.full_name,  // ADDED
  group_name: group?.name,
  reciprocal_date: request.reciprocal_date,     // ADDED
  reciprocal_start_time: request.reciprocal_start_time,  // ADDED
  reciprocal_end_time: request.reciprocal_end_time       // ADDED
};
```

**2. Provider View (lines 2606-2632)**
Updated the care_requests query to include reciprocal fields:
```typescript
.select('requested_date, start_time, end_time, request_type, requester_id, group_id, reciprocal_date, reciprocal_start_time, reciprocal_end_time')
```

And added them to the returned data:
```typescript
return {
  ...response,
  existing_block_date: request.requested_date,
  existing_block_start_time: request.start_time,
  existing_block_end_time: request.end_time,
  group_name: group?.name,
  reciprocal_date: request.reciprocal_date,     // ADDED
  reciprocal_start_time: request.reciprocal_start_time,  // ADDED
  reciprocal_end_time: request.reciprocal_end_time       // ADDED
};
```

**3. UI Display (lines 1024-1156)**
Both acceptor and provider views now show:
- Block 1: Blue border = receiving care (with full details + button)
- Block 2: Green border = providing care (with full details + button OR fallback)
- Proper null checks to handle missing data gracefully
- Console logging for debugging

## What This Fixes

### Before:
- "You will provide care (Reciprocal)" showed: "For: Unknown"
- No date/time displayed
- No "View in Calendar" button
- Error when trying to navigate: "Invalid time value"

### After:
- "You will provide care (Reciprocal)" shows: "For: [Provider Name]"
- Full date/time details displayed
- "View in Calendar" button works correctly
- Graceful fallback if data missing

## Testing
1. Refresh the Messages/Schedule page
2. Expand an open block acceptance message
3. Verify BOTH blocks display with complete information
4. Click both "View in Calendar" buttons to verify navigation

## Build Status
✓ Build successful
✓ Scheduler bundle: 16.3 kB

## No SQL Changes Required
The database already has all the reciprocal data in the `care_requests` table. We just needed to fetch it in the frontend queries.
