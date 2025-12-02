# Calendar Counter Fix for Open Blocks and Reciprocal Care

## Problem
The calendar counter was not updating correctly when open blocks were accepted because:
1. Open block acceptances create different numbers of blocks for different users (acceptor gets 2, provider gets 1)
2. The Header was assuming ALL `care_accepted` notifications create 2 blocks (which is only true for reciprocal care)

## Solution
Added a `blocks_created` field to the notification data that specifies exactly how many NEW blocks were added for that user.

## Files Changed

### 1. Frontend Changes (Already Applied)
- **app/components/Header.tsx** - Updated calendar counter to read `blocks_created` from notification data instead of hardcoding *2

### 2. Backend Changes (Need to Deploy)

#### A. Reciprocal Care Function
- **File**: `DEPLOY_COMPLETE_notification_fix.sql`
- **Changes**: Added `blocks_created: 2` and `notification_source: 'reciprocal_care'` to notification data
- **Deploy**: Run this SQL in Supabase (you already deployed the constraint updates, but re-run to get the blocks_created field)

#### B. Open Block Function
- **File**: `FIXED_open_block_notifications.sql`
- **Changes**:
  - Added `blocks_created: 2` for acceptor notification (they get 2 new blocks)
  - Added `blocks_created: 1` for provider notification (they get 1 new reciprocal block)
  - Added `notification_source: 'open_block'` to both
- **Deploy**: Run this SQL in Supabase

## Deployment Steps

### Step 1: Deploy Reciprocal Care Function (Already Done, but Update)
```sql
-- Run DEPLOY_COMPLETE_notification_fix.sql in Supabase SQL Editor
-- This updates accept_reciprocal_care_response to include blocks_created
```

### Step 2: Deploy Open Block Function (NEW)
```sql
-- Run FIXED_open_block_notifications.sql in Supabase SQL Editor
-- This updates accept_open_block_invitation to:
-- 1. Create notifications with care_accepted type
-- 2. Include blocks_created field (2 for acceptor, 1 for provider)
```

### Step 3: Test
1. **Test Reciprocal Care**:
   - Have user A create a reciprocal care request
   - Have user B submit a response
   - Have user A accept user B's response
   - **Expected**: User B sees calendar counter +2
   - **Expected**: User B views calendar, counter goes to 0

2. **Test Open Blocks**:
   - Have user A create an open block
   - Have user B accept the open block
   - **Expected**: User B (acceptor) sees calendar counter +2
   - **Expected**: User A (provider) sees calendar counter +1
   - **Expected**: Both counters go to 0 when viewing calendar

## How It Works

### Reciprocal Care
- When requester accepts a response, responder gets notification with `blocks_created: 2`
- Header counts: 2 blocks added to calendar counter
- Responder gets: 1 "needed" block + 1 "provided" block

### Open Blocks
- When someone accepts an open block:
  - **Acceptor** gets notification with `blocks_created: 2`
    - They get: 1 "needed" block (original time) + 1 "provided" block (reciprocal time)
  - **Provider** gets notification with `blocks_created: 1`
    - They get: 1 "needed" block (reciprocal time)
    - They already had the original "provided" block

### Header Logic
The Header now reads the `blocks_created` field from each notification and sums them up:
```typescript
const notificationBlocks = careAcceptedNotifications.reduce((total, notification) => {
  const blocksCreated = notification.data?.blocks_created || 2; // Default to 2 for old notifications
  return total + blocksCreated;
}, 0);
```

## Backward Compatibility
The Header defaults to `2` if `blocks_created` is not present, so old notifications will still work correctly.
