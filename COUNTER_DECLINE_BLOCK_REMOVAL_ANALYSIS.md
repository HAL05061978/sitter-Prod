# Counter-Decline Block Removal Analysis

## Issue Description
When a rescheduling parent (Rosmary) declines a counter-proposal from another parent (Bruce), the selected block that Bruce chose is not being removed properly for EITHER parent.

## What SHOULD Happen

### Scenario:
1. **Rosmary** reschedules Nov 8 block to Nov 6
2. **Bruce** counters with Nov 7, and selects "Nov 8 block" to keep (cancellation)
3. **Rosmary** declines Bruce's counter

### Expected Result:
- Bruce's yellow blocks (Nov 8) should be removed
- The "Nov 8 block" Bruce selected should have Rosmary's child removed
- If Nov 8 block becomes empty or only has provider's child, it should be cancelled

## What the Code Does (Lines 509-817 in Current Function)

### Step 1: Remove Counter-Proposer from Yellow Blocks (Lines 516-537)
```sql
-- Remove Bruce's child from yellow providing block
DELETE FROM scheduled_care_children
WHERE child_id = v_requester_child_id  -- Bruce's child
AND scheduled_care_id IN (
    SELECT id FROM scheduled_care
    WHERE care_type = 'provided'
    AND status = 'rescheduled'
    ...
);

-- Remove Bruce's yellow needed block
DELETE FROM scheduled_care
WHERE parent_id = v_care_request.requester_id  -- Bruce
AND care_type = 'needed'
AND status = 'rescheduled'
...
```
✅ THIS PART WORKS - Removes Bruce from yellow blocks

### Step 2: Get the Selected Arrangement (Lines 539-546)
```sql
SELECT selected_cancellation_request_id INTO v_counter_proposer_selected_arrangement
FROM care_responses
WHERE request_id = v_care_request.counter_proposal_to  -- Original reschedule request
AND responder_id = v_care_request.requester_id  -- Bruce
AND decline_action = 'counter_propose'
LIMIT 1;
```
✅ THIS SHOULD WORK - Gets the arrangement Bruce selected (Nov 8 block)

### Step 3: Cancel the Selected Block (Lines 549-655)
This is where the problem likely is. The code tries to:

1. **Get original rescheduler's child** (Line 554-559)
2. **Remove rescheduler's child from PROVIDING blocks** (Lines 560-568)
3. **Remove rescheduler's child from NEEDED blocks** (Lines 574-588)
4. **Delete meaningless NEEDED blocks** (Lines 594-619)
5. **Cancel empty or self-only PROVIDING blocks** (Lines 621-650)

## Potential Issues

### Issue 1: Matching by `related_request_id`
Line 565: `AND sc.related_request_id = v_counter_proposer_selected_arrangement`

**Problem**: If Bruce selected an **open block** that was accepted, the blocks created might have a DIFFERENT `related_request_id` (the acceptance request ID, not the original open block request ID).

### Issue 2: Variable Naming Confusion
- `v_requester_child_id` = Bruce's child (counter-proposer)
- `v_original_rescheduler_child_id` = Rosmary's child (original rescheduler)

The code removes `v_original_rescheduler_child_id` (Rosmary's), but maybe it should ALSO remove Bruce's child?

### Issue 3: Status Filtering
Line 566: `AND sc.status != 'rescheduled'  -- Don't touch yellow blocks`

This is correct - we want to modify the NON-yellow blocks (confirmed blocks from the selected arrangement).

## Debug Questions

1. **Is `v_counter_proposer_selected_arrangement` being found?**
   - Check RAISE NOTICE at line 552

2. **Is `v_original_rescheduler_child_id` being found?**
   - Check if line 554-559 query returns a result

3. **Are any rows being deleted in Step 3?**
   - Check RAISE NOTICE messages for "Removed rescheduler child..."

4. **Are providing blocks being cancelled?**
   - Check if UPDATE at line 624 is executing

## Recommendation

The user should check the database or logs to see:
1. What is the value of `v_counter_proposer_selected_arrangement`?
2. What blocks exist at the time of decline with that `related_request_id`?
3. Are there any blocks that DON'T have `related_request_id` set to that value but should be affected?

The issue is likely that the selected arrangement's blocks have a DIFFERENT `related_request_id` than expected, causing the WHERE clauses to not match any blocks.
