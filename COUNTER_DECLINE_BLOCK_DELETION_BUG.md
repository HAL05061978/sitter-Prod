# Bug: Counter-Proposal Decline Deletes Entire Providing Block

## Problem Summary
When a counter-proposal from a parent involved in the **original reciprocal agreement** (Hugo) is declined by the original rescheduling parent (Rosmary), Hugo's entire providing block gets deleted instead of just removing Rosmary's child from it.

## Scenario
1. **Original reciprocal arrangement**: Rosmary ↔ Hugo (Oct 26 22:00-23:00)
2. **Hugo opens block** to others at his providing time (Oct 27 07:30-11:30)
3. **Bruce accepts** Hugo's open block (reciprocal care Oct 31 14:05-18:05)
4. **Karen accepts** Hugo's open block (reciprocal care Oct 30 14:00-18:00)
5. **Rosmary requests reschedule** to Nov 1 15:30-19:30
6. **Everyone in group declines**:
   - Hugo declines with counter-proposal (Nov 3 17:00-21:00), selecting original reciprocal block to cancel
   - Bruce declines with counter-proposal
   - Karen declines with counter-proposal
7. **Rosmary declines all counters**
8. **BUG**: When Rosmary declines Hugo's counter, lines 416-427 delete Hugo's **entire** providing block

## Current State After Bug
**Hugo's blocks**: MISSING entirely
- No providing block at Oct 27 07:30-11:30 (should still have Bruce and Karen's children)

**Bruce's blocks**:
- ✅ Needed block at Oct 27 07:30-11:30 (but incorrectly still has Rosmary's child)
- ✅ Provided block at Oct 31 14:05-18:05

**Karen's blocks**:
- ✅ Needed block at Oct 30 14:00-18:00
- ✅ Provided block at Oct 30 14:00-18:00

**Rosmary's blocks**: NONE (correct - she has no confirmed arrangements)

## Expected State
**Hugo's blocks**:
- ✅ Providing block at Oct 27 07:30-11:30 with 2 children:
  - Bruce's child
  - Karen's child
  - (Rosmary's child removed)

**Bruce's blocks**:
- ✅ Needed block at Oct 27 07:30-11:30 with Hugo's child and Bruce's child (Rosmary's child removed)
- ✅ Provided block at Oct 31 14:05-18:05

**Karen's blocks**:
- ✅ Needed block at Oct 30 14:00-18:00 with Hugo's child and Karen's child (Rosmary's child removed)
- ✅ Provided block at Oct 30 14:00-18:00

## Root Cause Analysis

### Lines 416-427 in `handle_improved_reschedule_response`

```sql
IF v_counter_proposer_selected_arrangement IS NOT NULL THEN
    RAISE NOTICE 'Canceling arrangement % that Bruce selected when sending counter',
        v_counter_proposer_selected_arrangement;

    -- ✅ CRITICAL: Only delete NON-YELLOW blocks
    DELETE FROM scheduled_care
    WHERE related_request_id = v_counter_proposer_selected_arrangement
    AND status != 'rescheduled';  -- Don't delete yellow blocks!

    UPDATE care_requests
    SET status = 'canceled'
    WHERE id = v_counter_proposer_selected_arrangement;
END IF;
```

### Problem 1: Should Anything Be Deleted When Counter Is Declined?

**NO!** When a counter-proposal is declined:
- The counter is **rejected**
- The "selected arrangement to cancel" was conditional: "IF you accept my counter, THEN cancel this arrangement"
- Since the counter was declined, the condition never triggered
- The selected arrangement should **remain active**

### Problem 2: Even If Deletion Was Correct, It's Deleting the Wrong Thing

The code deletes the **entire `scheduled_care` block**:
```sql
DELETE FROM scheduled_care
WHERE related_request_id = v_counter_proposer_selected_arrangement
```

This removes:
1. The `scheduled_care` row (Hugo's providing block)
2. ALL children in `scheduled_care_children` (cascade delete)

**Result**: Bruce and Karen lose Hugo's block entirely, even though they're still participating!

### What Should Happen Instead

When declining a counter-proposal from a parent in the original reciprocal agreement:
1. **Remove the original requester's child** (Rosmary's child) from the counter-proposer's providing block
2. **Keep the block** if other children remain (Bruce, Karen)
3. **Don't touch the selected arrangement** (it stays active - the counter was declined)

## Evidence from CSV Files

### `scheduled_care_RescheduleCounterFromReciDeclined.csv`
Shows only 6 blocks remaining:
- 2 for Bruce (needed + provided)
- 2 for Karen (needed + provided)
- 2 for Hugo (needed blocks only)
- **MISSING**: Hugo's providing block at Oct 27 07:30-11:30

### `scheduled_care_children_RescheduleCounterFromReciDeclined.csv`
Shows children in remaining blocks:
- Bruce's needed block (aacc4cb6...) still has Rosmary's child (24015a99...) ❌ WRONG
- Karen's needed block (609ab459...) still has Rosmary's child (24015a99...) ❌ WRONG
- Hugo's providing block is completely gone ❌ WRONG

### `care_requests_RescheduleCounterFromReciDeclined.csv`
- Original reciprocal request (cd4e9f87...): status = "canceled" ❌ WRONG (should remain if Bruce/Karen still there)
- Hugo's counter (772d33eb...): status = "declined" ✅ CORRECT
- Rosmary's reschedule (c5975d69...): status = "completed" ✅ CORRECT

## The Fix

### Part 1: Don't Delete Selected Arrangement When Counter Is Declined

**Remove lines 416-427 entirely**. Replace with:
```sql
-- When counter-proposal is DECLINED, do NOT cancel the selected arrangement
-- The selected arrangement only cancels if the counter is ACCEPTED
RAISE NOTICE 'Counter-proposal declined - selected arrangement % remains active',
    v_counter_proposer_selected_arrangement;
```

### Part 2: Remove Original Requester's Child from Counter-Proposer's Blocks

The existing code at lines 383-404 already removes the counter-proposer's child from yellow blocks. We need similar logic to remove the **original requester's child** from the **counter-proposer's providing blocks**.

Add after line 404:
```sql
-- Remove original requester's child from counter-proposer's providing blocks
DELETE FROM scheduled_care_children scc
USING scheduled_care sc
WHERE scc.scheduled_care_id = sc.id
AND sc.parent_id = v_care_request.requester_id  -- Hugo (counter-proposer)
AND sc.group_id = v_care_request.group_id
AND sc.care_type = 'provided'
AND sc.status = 'confirmed'  -- Only confirmed blocks, not yellow
AND sc.care_date = v_care_request.reciprocal_date
AND sc.start_time = v_care_request.reciprocal_start_time
AND sc.end_time = v_care_request.reciprocal_end_time
AND scc.child_id = (
    -- Get the original reschedule requester's child
    SELECT child_id
    FROM care_requests
    WHERE id = v_care_request.counter_proposal_to
    LIMIT 1
);

RAISE NOTICE 'Removed original requester child from counter-proposer providing blocks';
```

## Similar to Earlier Bug

This is similar to the bug we fixed in lines 527-568 where declining a reschedule was deleting entire blocks instead of just removing the specific child. The fix there was:

1. Find the providing block
2. Count children before removal
3. Remove **only** the requester's child
4. If that was the **only** child, cancel the block
5. Otherwise, **keep** the block

We need the same logic here, but with awareness that we're declining a **counter-proposal**, not a regular reschedule.

## Action Items

1. Remove lines 416-427 (don't delete selected arrangement on counter decline)
2. Add logic to remove original requester's child from counter-proposer's providing blocks
3. Add logic to remove original requester's child from all other participants' needed blocks
4. Test the scenario:
   - Open block with multiple acceptances
   - Original reciprocal parent requests reschedule
   - Counter-proposer declines with counter
   - Original requester declines the counter
   - Verify blocks remain with correct children
