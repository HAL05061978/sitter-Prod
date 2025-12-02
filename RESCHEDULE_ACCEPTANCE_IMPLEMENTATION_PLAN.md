# Reschedule Acceptance/Decline Messages - Implementation Plan

## Answer to Your Questions

### 1. Will the frontend show empty templates without backend data?

**No.** The frontend only displays messages when actual data exists from database queries. Here's how it works:

```typescript
// Frontend queries reschedule responses from Supabase
rescheduleRequests.forEach((request) => {
  // Only creates message if request exists in data
  messages.push({
    type: 'reschedule_request',
    title: `${request.requester_name} wants to reschedule...`,
    // ...
  });
});
```

**Safe to implement frontend first** because:
- No data = no messages displayed
- No empty templates or errors
- When backend starts creating the data, messages will automatically appear

### 2. Which functions need to be updated?

## Backend Function to Update

### Primary Function: `handle_improved_reschedule_response`

**Location:** Deployed in production migrations
- Current version: `DEPLOY_FIXED_handle_improved_reschedule_response_v2.sql`
- Migration: `supabase/supabase/migrations/20251024120200_deploy_handle_improved_reschedule_response.sql`

**This function needs to create notification messages** when:
- Status is 'accepted' → Create acceptance messages for both parties
- Status is 'declined' → Create decline messages for both parties

### Existing Infrastructure

**Notifications Table** (already exists):
```sql
-- From migration: 20250115000015_add_reschedule_notifications.sql
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id),
    type TEXT NOT NULL CHECK (type IN ('reschedule_request', 'reschedule_response', ...)),
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    data JSONB,
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**Helper Function** (already exists):
```sql
-- From migration: 20250115000015_add_reschedule_notifications.sql
CREATE FUNCTION create_reschedule_notifications(
    p_reschedule_request_id UUID,
    p_requester_id UUID,
    p_original_request_id UUID
)
```

## Implementation Steps

### Step 1: Update Backend (SQL Function)

Add to `handle_improved_reschedule_response` function, after the blocks are updated successfully:

```sql
-- After line ~800 (after all block updates complete)

-- Create notification messages for reschedule acceptance/decline
IF p_response_status = 'accepted' THEN
    -- Message for requester (person who initiated reschedule)
    INSERT INTO notifications (user_id, type, title, message, data)
    VALUES (
        v_care_request.requester_id,
        'reschedule_accepted',
        (SELECT full_name FROM profiles WHERE id = p_responder_id) ||
            ' accepted your reschedule request for ' ||
            TO_CHAR(v_care_request.original_date, 'Mon DD, YYYY'),
        '',
        jsonb_build_object(
            'requester_id', v_care_request.requester_id,
            'responder_id', p_responder_id,
            'responder_name', (SELECT full_name FROM profiles WHERE id = p_responder_id),
            'original_date', v_care_request.original_date,
            'original_start_time', v_care_request.original_start_time,
            'original_end_time', v_care_request.original_end_time,
            'new_date', COALESCE(v_care_request.new_date, v_care_request.original_date),
            'new_start_time', COALESCE(v_care_request.new_start_time, v_care_request.original_start_time),
            'new_end_time', COALESCE(v_care_request.new_end_time, v_care_request.original_end_time),
            'care_response_id', p_care_response_id
        )
    );

    -- Message for responder (person who accepted)
    INSERT INTO notifications (user_id, type, title, message, data)
    VALUES (
        p_responder_id,
        'reschedule_accepted',
        'You accepted ' ||
            (SELECT full_name FROM profiles WHERE id = v_care_request.requester_id) ||
            '''s reschedule request for ' ||
            TO_CHAR(v_care_request.original_date, 'Mon DD, YYYY'),
        '',
        jsonb_build_object(
            'requester_id', v_care_request.requester_id,
            'requester_name', (SELECT full_name FROM profiles WHERE id = v_care_request.requester_id),
            'responder_id', p_responder_id,
            'original_date', v_care_request.original_date,
            'original_start_time', v_care_request.original_start_time,
            'original_end_time', v_care_request.original_end_time,
            'new_date', COALESCE(v_care_request.new_date, v_care_request.original_date),
            'new_start_time', COALESCE(v_care_request.new_start_time, v_care_request.original_start_time),
            'new_end_time', COALESCE(v_care_request.new_end_time, v_care_request.original_end_time),
            'care_response_id', p_care_response_id
        )
    );

ELSIF p_response_status = 'declined' THEN
    -- Message for requester (person who initiated reschedule)
    INSERT INTO notifications (user_id, type, title, message, data)
    VALUES (
        v_care_request.requester_id,
        'reschedule_declined',
        (SELECT full_name FROM profiles WHERE id = p_responder_id) ||
            ' declined your reschedule request for ' ||
            TO_CHAR(v_care_request.original_date, 'Mon DD, YYYY'),
        '',
        jsonb_build_object(
            'requester_id', v_care_request.requester_id,
            'responder_id', p_responder_id,
            'responder_name', (SELECT full_name FROM profiles WHERE id = p_responder_id),
            'original_date', v_care_request.original_date,
            'care_response_id', p_care_response_id
        )
    );

    -- Message for responder (person who declined)
    INSERT INTO notifications (user_id, type, title, message, data)
    VALUES (
        p_responder_id,
        'reschedule_declined',
        'You declined ' ||
            (SELECT full_name FROM profiles WHERE id = v_care_request.requester_id) ||
            '''s reschedule request for ' ||
            TO_CHAR(v_care_request.original_date, 'Mon DD, YYYY'),
        '',
        jsonb_build_object(
            'requester_id', v_care_request.requester_id,
            'requester_name', (SELECT full_name FROM profiles WHERE id = v_care_request.requester_id),
            'responder_id', p_responder_id,
            'original_date', v_care_request.original_date,
            'care_response_id', p_care_response_id
        )
    );
END IF;
```

### Step 2: Update Notifications Table Type Constraint

```sql
-- Add new types to the notifications table constraint
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_type_check
    CHECK (type IN (
        'reschedule_request',
        'reschedule_response',
        'reschedule_accepted',    -- NEW
        'reschedule_declined',    -- NEW
        'care_request',
        'care_response',
        'group_invitation',
        'system'
    ));
```

### Step 3: Update Frontend Query

Update the query that fetches notifications to include the new types:

**File:** `app/scheduler/page.tsx` (around line 1667)

Add query to fetch reschedule acceptance/decline notifications from the `notifications` table and add them to the messages array.

### Step 4: Update Frontend Message Types

**File:** `app/scheduler/page.tsx`

**Line 464 - Add new types:**
```typescript
type: 'open_block_invitation' | 'care_request' | 'care_response' | 'care_accepted' |
      'care_declined' | 'open_block_accepted' | 'group_invitation' | 'event_invitation' |
      'reschedule_request' | 'reschedule_accepted' | 'reschedule_declined';
```

**Lines 903-915 - Add badge styling:**
```typescript
message.type === 'reschedule_accepted' ? 'bg-green-100 text-green-800' :
message.type === 'reschedule_declined' ? 'bg-red-100 text-red-800' :
```

**Lines 917-929 - Add badge labels:**
```typescript
message.type === 'reschedule_accepted' ? 'Accepted' :
message.type === 'reschedule_declined' ? 'Declined' :
```

**Line 875 - Disable expand for declined:**
```typescript
if (message.type === 'care_declined' || message.type === 'reschedule_request' || message.type === 'reschedule_declined') return;
```

**Line 973 - Hide arrow for declined:**
```typescript
{message.type !== 'group_invitation' &&
 message.type !== 'care_declined' &&
 message.type !== 'reschedule_request' &&
 message.type !== 'reschedule_declined' && (
```

**After line 1231 - Add expanded view for accepted:**
```typescript
{/* Show accepted reschedule details */}
{message.type === 'reschedule_accepted' && (
  <div className="space-y-3 mb-4">
    <div className="bg-green-50 rounded-lg p-3 border-l-4 border-green-500">
      <div className="flex-1">
        <p className="font-medium text-gray-900 text-sm">
          New care block
        </p>
        <p className="text-sm text-gray-600 mt-1">
          {formatDateOnly(message.data.new_date)} from{' '}
          {formatTime(message.data.new_start_time)} to {formatTime(message.data.new_end_time)}
        </p>
        <button
          onClick={() => navigateToCareBlock(message.data.new_date, 'provided')}
          className="inline-block mt-3 px-4 py-2 bg-green-600 text-white text-sm rounded hover:bg-green-700 transition-colors"
        >
          View in Calendar
        </button>
      </div>
    </div>
  </div>
)}
```

## Summary

### Functions to Update:
1. **`handle_improved_reschedule_response`** - Main function that handles Accept/Decline
2. **Notifications table constraint** - Add new message types
3. **Frontend scheduler** - Add display logic for new message types

### Safe Implementation Order:
1. ✅ **Frontend first** (no impact if backend doesn't exist yet)
2. ✅ **Backend second** (messages will immediately appear once created)

### Pattern Reference:
Follow the same pattern as:
- Open block acceptance: `accept_open_block_invitation` function
- Reciprocal acceptance: Already implemented in frontend (lines 1208-1231)
- Message format: "{Name} accepted/declined your reschedule request for {Date}"

This will provide complete notification coverage for reschedule Accept/Decline actions.
