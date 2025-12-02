# Correct Understanding of Counter-Decline Bug

## The User's Clarification

**Key Point**: The original agreement between Hugo and Rosmary is NOT intact after Rosmary's reschedule is declined. However, Hugo's obligation to Bruce and Karen (from open block acceptances) IS still intact.

## The Scenario (Correct Understanding)

1. **Hugo ↔ Rosmary original reciprocal**:
   - Hugo provides care at Oct 27 07:30-11:30
   - Rosmary provides care at Oct 26 23:00-24:00
   - Status: Active reciprocal agreement

2. **Hugo opens his providing block** to the group:
   - Bruce accepts (reciprocal care Oct 31 14:05-18:05)
   - Karen accepts (reciprocal care Oct 30 14:00-18:00)
   - Hugo's block now has: Hugo's child, Rosmary's child, Bruce's child, Karen's child

3. **Rosmary requests reschedule** to Nov 1 15:30-19:30:
   - This creates yellow (rescheduled) blocks
   - Everyone needs to respond

4. **Everyone declines**:
   - Bruce declines (simple decline or with counter that gets declined)
   - Karen declines with counter-proposal
   - Hugo declines with counter-proposal, selecting the original reciprocal to cancel
   - Rosmary declines all counters

5. **Expected Result**:
   - ✅ **Rosmary has NO blocks** (reschedule declined by everyone = no care arrangement)
   - ✅ **Hugo still has providing block** with Bruce and Karen's children (NOT Rosmary)
   - ✅ **Bruce still has needed block** from Hugo (without Rosmary's child)
   - ✅ **Karen still has needed block** from Hugo (without Rosmary's child)
   - ✅ **Original Hugo ↔ Rosmary reciprocal is CANCELLED** (everyone declined = arrangement ends)

## What Test 1 (ReschedulingDeclineBroken) Shows - WRONG INTERPRETATION

I was WRONG to say this was correct. Looking again:

Hugo's providing block (8dacbec8...) has 4 children:
- Hugo's child (24015a99...)
- Bruce's child (3d9d40ea...)
- **Rosmary's child (5f093c84...)** ❌ SHOULD NOT BE THERE
- Karen's child (a42af785...)

**This is actually WRONG!** Rosmary's child should have been removed because the reschedule was declined by everyone.

## What Test 2 (RescheduleCounterFromReciDeclined) Shows

Hugo's providing block is COMPLETELY MISSING - this is the bug from lines 416-427.

## The Correct Behavior

When Rosmary's reschedule is declined by everyone:

### What happens to the original Hugo ↔ Rosmary reciprocal?
**It ENDS.** When a reschedule is declined by all parties, the original arrangement is cancelled.

### What happens to Hugo's open block arrangements?
**They STAY.** Bruce and Karen accepted the open block separately from the original reciprocal arrangement. Their acceptances create independent reciprocal agreements with Hugo.

### Final state should be:
1. **Hugo's providing block at Oct 27 07:30-11:30**:
   - Hugo's child ✅
   - Bruce's child ✅
   - Karen's child ✅
   - (Rosmary's child removed ✅)

2. **Bruce's blocks**:
   - Needed at Oct 27 07:30-11:30 (without Rosmary's child)
   - Provided at Oct 31 14:05-18:05

3. **Karen's blocks**:
   - Needed at Oct 27 07:30-11:30 (without Rosmary's child)
   - Provided at Oct 30 14:00-18:00

4. **Rosmary's blocks**: NONE (all arrangements cancelled)

## Where Things Go Wrong

### Test 1 Problem:
Rosmary's child is STILL in Hugo's block when it shouldn't be. The regular decline logic (lines 527-618) should have removed Rosmary's child from Hugo's providing block, but it didn't.

### Test 2 Problem (The Bug We're Fixing):
When Rosmary declines Hugo's counter-proposal, lines 416-427 delete Hugo's ENTIRE providing block, removing Bruce and Karen too.

## The Issue with Lines 416-427

```sql
IF v_counter_proposer_selected_arrangement IS NOT NULL THEN
    RAISE NOTICE 'Canceling arrangement % that Bruce selected when sending counter',
        v_counter_proposer_selected_arrangement;

    DELETE FROM scheduled_care
    WHERE related_request_id = v_counter_proposer_selected_arrangement
    AND status != 'rescheduled';

    UPDATE care_requests
    SET status = 'canceled'
    WHERE id = v_counter_proposer_selected_arrangement;
END IF;
```

This code:
1. Gets the "selected arrangement" that Hugo chose when creating his counter
2. **Deletes ALL `scheduled_care` blocks** with `related_request_id = selected_arrangement`
3. This includes Hugo's providing block, which has Bruce and Karen

**Why this is wrong**:
- Hugo's counter was DECLINED
- The "selected arrangement to cancel" only applies if the counter is ACCEPTED
- Since declined, nothing should be cancelled
- Even if something should be cancelled, it's deleting the entire block instead of just Rosmary's child

## The Correct Fix

When declining a counter-proposal from Hugo:

1. **Remove Hugo's child from yellow blocks** (already done lines 383-395) ✅
2. **Remove Hugo's yellow needed block** (already done lines 396-404) ✅
3. **Remove Rosmary's child from Hugo's confirmed providing block** (MISSING - needs to be added) ❌
4. **Remove Rosmary's child from Bruce and Karen's needed blocks** (MISSING - needs to be added) ❌
5. **Keep Hugo's block if it has other children** (Bruce, Karen) ✅
6. **Do NOT delete the entire selected arrangement** (remove lines 416-427) ✅

## Summary

The fix needs to:
1. **Remove lines 416-427** (don't delete entire selected arrangement)
2. **Add logic to remove Rosmary's child** from Hugo's providing block (similar to lines 547-568 for regular declines)
3. **Add logic to remove Rosmary's child** from other participants' (Bruce, Karen) needed blocks (similar to lines 570-582 for regular declines)

This is similar to the regular decline logic, but applies when declining a COUNTER-PROPOSAL from the original reciprocal partner.
