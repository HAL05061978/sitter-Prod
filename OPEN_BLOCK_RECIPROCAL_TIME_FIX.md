# Open Block Reciprocal Time Fix

## Problem Description

When users accept open block invitations, the system was incorrectly populating the `care_requests` table's reciprocal fields (`reciprocal_date`, `reciprocal_start_time`, `reciprocal_end_time`) with the open block offer times instead of using the existing scheduled care block times.

## Root Cause

In the `accept_open_block_invitation` function, the reciprocal time fields were being set using:
- `v_care_request.requested_date` (open block offer date)
- `v_care_request.start_time` (open block offer start time)  
- `v_care_request.end_time` (open block offer end time)

Instead of using the correct source: the `scheduled_care` table referenced by `existing_block_id`.

## Solution

The fix involves:

1. **Query the existing block times**: Use `existing_block_id` to fetch the correct times from the `scheduled_care` table
2. **Store correct reciprocal times**: Update the `care_requests` table with the actual existing block times
3. **Maintain data integrity**: Ensure the reciprocal arrangement reflects the real time blocks

## Code Changes

### Before (Incorrect)
```sql
-- Update care_requests with reciprocal information from the acceptance
UPDATE care_requests 
SET 
    status = 'accepted',
    responder_id = p_accepting_parent_id,
    response_notes = v_care_request.notes || ' - Open block accepted',
    -- INCORRECT: Using open block offer times
    reciprocal_parent_id = p_accepting_parent_id,
    reciprocal_child_id = p_accepted_child_id,
    reciprocal_date = v_care_request.requested_date,        -- ❌ Wrong source
    reciprocal_start_time = v_care_request.start_time,      -- ❌ Wrong source
    reciprocal_end_time = v_care_request.end_time,          -- ❌ Wrong source
    reciprocal_status = 'accepted'
WHERE id = v_care_request_id;
```

### After (Correct)
```sql
-- Get the existing block times from scheduled_care table using existing_block_id
IF v_care_request.existing_block_id IS NOT NULL THEN
    SELECT care_date, start_time, end_time INTO v_existing_block_date, v_existing_block_start_time, v_existing_block_end_time
    FROM scheduled_care 
    WHERE id = v_care_request.existing_block_id;
    
    IF NOT FOUND THEN
        RETURN 'Existing scheduled care block not found';
    END IF;
ELSE
    RETURN 'Missing existing_block_id in care request';
END IF;

-- Update care_requests with reciprocal information from the acceptance
-- FIXED: Use existing_block_id to get the correct times from scheduled_care table
UPDATE care_requests 
SET 
    status = 'accepted',
    responder_id = p_accepting_parent_id,
    response_notes = v_care_request.notes || ' - Open block accepted',
    -- FIXED: Use existing block times instead of open block offer times
    reciprocal_parent_id = p_accepting_parent_id,
    reciprocal_child_id = p_accepted_child_id,
    reciprocal_date = v_existing_block_date,           -- ✅ Correct source
    reciprocal_start_time = v_existing_block_start_time, -- ✅ Correct source
    reciprocal_end_time = v_existing_block_end_time,     -- ✅ Correct source
    reciprocal_status = 'accepted'
WHERE id = v_care_request_id;
```

## Impact

This fix ensures that:

1. **Accurate reciprocal arrangements**: The reciprocal time blocks reflect the actual existing scheduled care times
2. **Proper time block creation**: Two different time blocks are created as intended
3. **Data consistency**: The `care_requests` table accurately represents the reciprocal arrangement
4. **Correct scheduling**: Parents see the correct times in their calendars and schedules

## Testing

To verify the fix:

1. Create an open block invitation with an existing scheduled care block
2. Accept the invitation as a different parent
3. Verify that the `care_requests.reciprocal_*` fields contain the existing block times (not the open block offer times)
4. Confirm that the scheduled care blocks are created with the correct times

## Files Modified

- `fix_open_block_function_correct.sql` - Updated the `accept_open_block_invitation` function
