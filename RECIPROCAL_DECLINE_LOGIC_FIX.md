# Reciprocal Decline Logic Fix

## Problem Summary

When accepting reciprocal care responses, the system was not properly declining all other responses. The issue was that the `handle_care_response_action` function (which handles reciprocal acceptances) was only declining responses with `status = 'pending'`, but some responses have `status = 'submitted'` which were not being declined.

## Root Cause

The problem was in the wrong function. I initially applied the fix to `accept_open_block_invitation` function, but that function handles **open block invitations** which use different logic (`block_time_id` and `invited_parent_id`).

The actual issue was in the `handle_care_response_action` function, which handles **reciprocal acceptances** and uses simpler logic based on `request_id`.

## The Correct Fix

### Function: `handle_care_response_action` (Reciprocal Acceptances)

**Before (Incorrect):**
```sql
-- Decline all other responses for this request
UPDATE care_responses 
SET status = 'declined'
WHERE request_id = v_care_request_id
AND id != p_care_response_id
AND status = 'pending';  -- ❌ Only declining 'pending' status
```

**After (Correct):**
```sql
-- Decline all other responses for this request
UPDATE care_responses 
SET status = 'declined'
WHERE request_id = v_care_request_id
AND id != p_care_response_id
AND status IN ('pending', 'submitted');  -- ✅ Declining both 'pending' and 'submitted' statuses
```

## Why This Fix is Correct

### 1. **Different Response Types**
- **Open Block Invitations**: Use `block_time_id` and `invited_parent_id` logic
- **Reciprocal Acceptances**: Use simple `request_id` logic

### 2. **Different Status Patterns**
- **Open Block Responses**: Typically start with `status = 'pending'`
- **Reciprocal Responses**: Can have `status = 'submitted'` when someone submits a response

### 3. **Different Decline Logic**
- **Open Block**: Decline based on time slot (`block_time_id`) and parent (`invited_parent_id`)
- **Reciprocal**: Decline all other responses for the same request (`request_id`)

## Expected Behavior After Fix

### When Accepting Reciprocal Response:
- ✅ The accepted response status changes to `'accepted'`
- ✅ All other responses with `status = 'pending'` are declined
- ✅ All other responses with `status = 'submitted'` are declined
- ✅ No other responses remain active for the same request

## Files Modified

1. **`fix_reciprocal_care_id.sql`** - Fixed the decline logic in `handle_care_response_action` function
2. **`RECIPROCAL_DECLINE_LOGIC_FIX.md`** - This documentation file

## Testing

To verify the fix:
1. Create a reciprocal care request
2. Have multiple parents submit responses (these will have `status = 'submitted'`)
3. Accept one of the responses
4. Verify that all other responses (both `'pending'` and `'submitted'`) are declined

## Note

The `accept_open_block_invitation` function was reverted to its original state since it handles a different type of acceptance logic and was not the source of the issue.
