# Counter-Decline Complete Fix Summary

## Problem
When a counter-proposal is declined (e.g., Hugo counters Rosmary's reschedule, then Rosmary declines Hugo's counter):
- Hugo's providing block with all 4 children (Hugo, Rosmary, Bruce, Karen) was being deleted entirely
- **EXPECTED**: Only remove Rosmary's child, keep Hugo, Bruce, and Karen
- **ALSO MISSING**: Rosmary's needed block was still showing on her calendar
- **ALSO MISSING**: Rosmary's child was still in Bruce and Karen's needed blocks

## Root Cause
In `handle_improved_reschedule_response` function (version 2, line 711), the counter-decline section (lines 415-453) was:
1. ✅ Removing Rosmary's child from Hugo's providing block (CORRECT)
2. ❌ NOT removing Rosmary's child from Bruce and Karen's needed blocks (BUG)
3. ❌ NOT deleting Rosmary's empty needed block (BUG)

## Solution
Updated the counter-decline section (lines 459-511 in the new version) to:

### 1. Remove from PROVIDING blocks (lines 459-468)
```sql
-- Remove ONLY the rescheduler's child from PROVIDING blocks
DELETE FROM scheduled_care_children scc
USING scheduled_care sc
WHERE scc.scheduled_care_id = sc.id
AND sc.related_request_id = v_counter_proposer_selected_arrangement
AND sc.status != 'rescheduled'  -- Don't touch yellow blocks
AND sc.care_type = 'provided'
AND scc.child_id = v_requester_child_id;
```

### 2. Remove from NEEDED blocks (lines 470-480) **NEW FIX**
```sql
-- Remove rescheduler's child from ALL related NEEDED blocks
-- (This includes Bruce and Karen's needed blocks)
DELETE FROM scheduled_care_children scc
USING scheduled_care sc
WHERE scc.scheduled_care_id = sc.id
AND sc.related_request_id = v_counter_proposer_selected_arrangement
AND sc.status != 'rescheduled'  -- Don't touch yellow blocks
AND sc.care_type = 'needed'
AND scc.child_id = v_requester_child_id;
```

### 3. Delete rescheduler's empty needed block (lines 482-498) **NEW FIX**
```sql
-- Delete the rescheduler's needed block (it should have no children now)
SELECT requester_id INTO v_original_reschedule_requester_id
FROM care_requests
WHERE id = v_care_request.counter_proposal_to;

DELETE FROM scheduled_care sc
WHERE sc.related_request_id = v_counter_proposer_selected_arrangement
AND sc.parent_id = v_original_reschedule_requester_id
AND sc.care_type = 'needed'
AND sc.status != 'rescheduled'
AND NOT EXISTS (
    SELECT 1 FROM scheduled_care_children scc
    WHERE scc.scheduled_care_id = sc.id
);
```

### 4. Cancel empty providing blocks (lines 500-511)
```sql
-- Cancel providing blocks only if they now have zero children
UPDATE scheduled_care sc
SET status = 'cancelled', action_type = 'cancelled'
WHERE sc.related_request_id = v_counter_proposer_selected_arrangement
AND sc.status != 'rescheduled'
AND sc.care_type = 'provided'
AND NOT EXISTS (
    SELECT 1 FROM scheduled_care_children scc
    WHERE scc.scheduled_care_id = sc.id
);
```

## Expected Result After Fix

After Hugo's counter is declined by Rosmary:

### Hugo's Calendar:
- ✅ Providing block (Oct 27 07:30-11:30) remains with 3 children: Hugo, Bruce, Karen
- ✅ Rosmary's child removed from this block

### Bruce's Calendar:
- ✅ Needed block (Oct 27 07:30-11:30) remains with Hugo, Bruce children
- ✅ Rosmary's child removed from this block

### Karen's Calendar:
- ✅ Needed block (Oct 27 07:30-11:30) remains with Hugo, Karen children
- ✅ Rosmary's child removed from this block

### Rosmary's Calendar:
- ✅ NO blocks (everyone declined her reschedule request)
- ✅ Her needed block is deleted (was empty after child removal)

## Additional Fix: Self-Only Blocks

**Issue**: When a counter is declined and the rescheduler's child is removed from the selected arrangement, if the block only has the providing parent's own child left, it was not being removed.

**Why this matters**: A parent can't provide care to only their own child - that's a meaningless block and should be removed.

**Solution**: Updated both counter-decline (lines 500-523) and regular decline (lines 658-673) sections to cancel blocks if:
- They have zero children, OR
- They only have the providing parent's own child (no other parents' children)

```sql
-- Cancel if empty OR only has provider's own child
AND (
    NOT EXISTS (SELECT 1 FROM scheduled_care_children WHERE scheduled_care_id = sc.id)
    OR
    NOT EXISTS (
        SELECT 1 FROM scheduled_care_children scc
        JOIN children c ON scc.child_id = c.id
        WHERE scc.scheduled_care_id = sc.id
        AND c.parent_id != sc.parent_id  -- Has a child NOT belonging to provider
    )
)
```

## Files

### Deployment File:
- **`DEPLOY_FIXED_handle_improved_reschedule_response_v2.sql`** (794 lines)
  - Complete function with all fixes
  - Based on version 2 (handle_improved_reschedule_response2.txt)
  - Added fixes for needed blocks and self-only block removal
  - Ready to deploy to Supabase

### Reference Files:
- `WriteUps/Functions/handle_improved_reschedule_response.txt` (685 lines) - Original version
- `WriteUps/Functions/handle_improved_reschedule_response2.txt` (744 lines) - Updated with fix

## Testing Checklist

After deploying, test the scenario:
1. ✅ Hugo ↔ Rosmary original reciprocal agreement
2. ✅ Hugo opens his providing block to Bruce and Karen
3. ✅ Bruce and Karen accept
4. ✅ Rosmary requests reschedule
5. ✅ Everyone declines
6. ✅ Hugo declines with counter-proposal, selecting original reciprocal to cancel
7. ✅ Rosmary declines Hugo's counter
8. **Verify**:
   - Hugo's providing block has Hugo, Bruce, Karen (3 children)
   - Bruce's needed block has Hugo, Bruce (2 children)
   - Karen's needed block has Hugo, Karen (2 children)
   - Rosmary has NO blocks
   - Rosmary's child is NOT in any blocks

## Technical Notes

- Added variable `v_original_reschedule_requester_id` to DECLARE section (line 22)
- Counter-decline section now has 4 distinct steps:
  1. Remove from providing blocks
  2. Remove from needed blocks (**NEW**)
  3. Delete empty needed block (**NEW**)
  4. Cancel empty providing blocks
- All deletions/updates check `status != 'rescheduled'` to preserve yellow blocks
- Empty block check uses `NOT EXISTS` to ensure no children remain
