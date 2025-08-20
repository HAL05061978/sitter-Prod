# Open Block Complete Fix - Time Storage and Calendar Building

## Problem Summary

The open block invitation system had two critical issues:

1. **Incorrect Time Storage**: When creating open block invitations, the times were being stored incorrectly in the `care_requests` table
2. **Reversed Providing/Receiving Logic**: The care responsibilities were being assigned incorrectly when someone accepted an invitation

## Root Causes

### 1. Time Storage Issue
- **`requested_date`, `start_time`, `end_time`** were storing the existing block times (the block being opened)
- **`reciprocal_date`, `reciprocal_start_time`, `reciprocal_end_time`** were NULL or incorrect
- **Accepting party fields** (`reciprocal_parent_id`, `reciprocal_child_id`, `responder_id`, `response_notes`) were being filled in during invitation creation instead of during acceptance

### 2. Calendar Building Issue
- The calendar was trying to build blocks using incorrect time sources
- Reciprocal times were being fetched from the wrong table
- The providing/receiving care logic was reversed

## Complete Solution

### Step 1: Fix `create_open_block_invitation` Function

**What it should do:**
- Store **original block times** (the block being opened) in `requested_date`, `start_time`, `end_time`
- Store **reciprocal times** (the times being offered) in `reciprocal_date`, `reciprocal_start_time`, `reciprocal_end_time`
- Leave **accepting party fields** NULL until someone accepts

**Key Changes:**
```sql
-- FIXED: Create the main care request with proper time storage
INSERT INTO care_requests (
    -- ... other fields ...
    requested_date,           -- ORIGINAL block date (the block being opened)
    start_time,               -- ORIGINAL block start time
    end_time,                 -- ORIGINAL block end time
    -- FIXED: Store reciprocal times (the times being offered in exchange)
    reciprocal_date,          -- RECIPROCAL date (first offered time)
    reciprocal_start_time,    -- RECIPROCAL start time (first offered time)
    reciprocal_end_time,      -- RECIPROCAL end time (first offered time)
    -- Leave accepting party fields NULL until someone accepts
    reciprocal_parent_id,     -- NULL until accepted
    reciprocal_child_id,      -- NULL until accepted
    responder_id,             -- NULL until accepted
    response_notes,           -- NULL until accepted
    reciprocal_status         -- NULL until accepted
) VALUES (
    -- ... other values ...
    v_original_block_date,    -- ORIGINAL block date (the block being opened)
    v_original_block_start_time, -- ORIGINAL block start time
    v_original_block_end_time,   -- ORIGINAL block end time
    -- FIXED: Store first reciprocal time (the time being offered in exchange)
    p_reciprocal_dates[1],        -- First reciprocal date
    p_reciprocal_start_times[1],  -- First reciprocal start time
    p_reciprocal_end_times[1],    -- First reciprocal end time
    NULL,  -- reciprocal_parent_id (NULL until accepted)
    NULL,  -- reciprocal_child_id (NULL until accepted)
    NULL,  -- responder_id (NULL until accepted)
    NULL,  -- response_notes (NULL until accepted)
    NULL   -- reciprocal_status (NULL until accepted)
);
```

### Step 2: Fix `accept_open_block_invitation` Function

**What it should do:**
- Get reciprocal times from `care_requests` table (now properly stored)
- Get existing block times from `scheduled_care` table for reference
- Fill in accepting party details only when someone accepts
- Create correct providing/receiving care blocks

**Key Changes:**
```sql
-- FIXED: Get reciprocal times from care_requests table (now properly stored)
SELECT reciprocal_date, reciprocal_start_time, reciprocal_end_time INTO v_reciprocal_date, v_reciprocal_start_time, v_reciprocal_end_time
FROM care_requests 
WHERE id = v_care_request_id;

-- Get existing block times for reference (needed for care_requests update)
SELECT care_date, start_time, end_time INTO v_existing_block_date, v_existing_block_start_time, v_existing_block_end_time
FROM scheduled_care 
WHERE id = v_care_request.existing_block_id;

-- FIXED: Only fill in accepting party details when someone accepts
UPDATE care_requests 
SET 
    status = 'accepted',
    responder_id = p_accepting_parent_id,
    response_notes = v_care_request.notes || ' - Open block accepted',
    -- Store the accepting party details
    reciprocal_parent_id = p_accepting_parent_id,
    reciprocal_child_id = p_accepted_child_id,
    reciprocal_status = 'accepted'
    -- Note: reciprocal_date, reciprocal_start_time, reciprocal_end_time are already set correctly
    -- from the create_open_block_invitation function
WHERE id = v_care_request_id;
```

### Step 3: Correct Providing/Receiving Care Logic

**The Correct Flow:**
1. **Block 1**: Parent C (accepting parent) **provides care** for the reciprocal time (existing block time)
2. **Block 2**: Original requester **receives care** for the reciprocal time (existing block time)
3. **Block 3**: Parent C (accepting parent) **receives care** for the original opened block time

**This creates the proper exchange:**
- Parent C provides care during the existing block time
- Parent C receives care during the original opened block time
- Original requester receives care during the existing block time

### Step 4: Fix Decline Logic for All Response Statuses ⭐ **NEW**

**What it should do:**
- Decline all responses with both `'pending'` and `'submitted'` statuses
- Ensure no other responses remain active when one is accepted

**Key Changes:**
```sql
-- FIXED: Decline all responses for the same block_time_id (same time slot) EXCEPT the accepted one
IF v_block_time_id IS NOT NULL THEN
    UPDATE care_responses 
    SET status = 'declined'
    WHERE block_time_id = v_block_time_id
    AND status IN ('pending', 'submitted')  -- FIXED: Include both pending and submitted statuses
    AND id != p_care_response_id;
    
    GET DIAGNOSTICS v_declined_count = ROW_COUNT;
    RAISE NOTICE 'Declined % responses for block_time_id %', v_declined_count, v_block_time_id;
END IF;

-- FIXED: Decline all responses for the same invited_parent_id (same parent) EXCEPT the accepted one
IF v_invited_parent_id IS NOT NULL THEN
    UPDATE care_responses 
    SET status = 'declined'
    WHERE invited_parent_id = v_invited_parent_id
    AND status IN ('pending', 'submitted')  -- FIXED: Include both pending and submitted statuses
    AND id != p_care_response_id;
    
    GET DIAGNOSTICS v_declined_count = ROW_COUNT;
    RAISE NOTICE 'Declined % responses for invited_parent_id %', v_declined_count, v_invited_parent_id;
END IF;
```

**Problem:**
- The decline logic was only looking for `status = 'pending'`
- Responses with `status = 'submitted'` were not being declined
- This left some responses active when they should have been declined

**Solution:**
- Updated decline logic to include both `'pending'` and `'submitted'` statuses
- Ensures all non-accepted responses are properly declined

## Files Modified

1. **`fix_create_open_block_invitation.sql`** - Fixed time storage in invitation creation
2. **`fix_open_block_function_correct.sql`** - Fixed acceptance logic and care responsibilities
3. **`OPEN_BLOCK_COMPLETE_FIX.md`** - This documentation file

## Expected Behavior After Fix

### When Creating Open Block Invitation:
- ✅ `requested_date`, `start_time`, `end_time` = Original block times (the block being opened)
- ✅ `reciprocal_date`, `reciprocal_start_time`, `reciprocal_end_time` = Reciprocal times (the times being offered)
- ✅ `reciprocal_parent_id`, `reciprocal_child_id`, `responder_id`, `response_notes` = NULL

### When Someone Accepts:
- ✅ `reciprocal_parent_id`, `reciprocal_child_id`, `responder_id`, `response_notes` = Filled in with accepting party details
- ✅ `reciprocal_date`, `reciprocal_start_time`, `reciprocal_end_time` = Already correctly stored
- ✅ 3 scheduled_care blocks created with correct providing/receiving logic
- ✅ Both children added to all blocks
- ✅ All other responses (both 'pending' and 'submitted') are declined

### Calendar Display:
- ✅ Parent C sees "Providing Care" for the reciprocal time (existing block time)
- ✅ Parent C sees "Receiving Care" for the original opened block time
- ✅ Original requester sees "Receiving Care" for the reciprocal time (existing block time)

## Deployment Steps

1. **Deploy `fix_create_open_block_invitation.sql`** to fix the invitation creation
2. **Deploy `fix_open_block_function_correct.sql`** to fix the acceptance logic
3. **Test with new open block invitations** (existing ones may need to be recreated)
4. **Verify calendar displays correctly** with proper providing/receiving care labels

## Testing Checklist

- [ ] Create new open block invitation
- [ ] Verify times are stored correctly in `care_requests` table
- [ ] Accept invitation as different parent
- [ ] Verify 3 scheduled_care blocks are created
- [ ] Verify providing/receiving care logic is correct
- [ ] Verify calendar displays correct care types and times
- [ ] Verify both children are added to all blocks
