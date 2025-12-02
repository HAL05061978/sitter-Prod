# Self-Only Block Removal Fix

## Problem

When Rosmary declines Karen's counter-proposal:
1. Rosmary's child is correctly removed from Karen's selected arrangement (the block Karen chose to cancel)
2. **BUG**: The block still shows in Karen's calendar with only Karen's own child
3. **ISSUE**: A parent can't provide care to only their own child - this is a meaningless block

## Example Scenario

**Before counter-decline**:
- Karen's providing block: Karen's child, Rosmary's child (2 children)

**After Rosmary declines Karen's counter** (OLD BEHAVIOR - BUG):
- Karen's providing block: Karen's child only (1 child) ❌ WRONG - meaningless block
- Block still shows on calendar

**After Rosmary declines Karen's counter** (NEW BEHAVIOR - FIXED):
- Karen's providing block: DELETED ✅ CORRECT - no other parents' children
- Block removed from calendar

## Solution

Updated the block cancellation logic in TWO places:

### 1. Counter-Decline Section (lines 500-523)

When a counter-proposal is declined, cancel the selected arrangement's providing blocks if:
- They have zero children, OR
- They only have the providing parent's own child

```sql
UPDATE scheduled_care sc
SET status = 'cancelled', action_type = 'cancelled'
WHERE sc.related_request_id = v_counter_proposer_selected_arrangement
AND sc.status != 'rescheduled'
AND sc.care_type = 'provided'
AND (
    -- Either no children at all
    NOT EXISTS (
        SELECT 1 FROM scheduled_care_children scc
        WHERE scc.scheduled_care_id = sc.id
    )
    OR
    -- Or only has the providing parent's own child (meaningless block)
    NOT EXISTS (
        SELECT 1 FROM scheduled_care_children scc
        JOIN children c ON scc.child_id = c.id
        WHERE scc.scheduled_care_id = sc.id
        AND c.parent_id != sc.parent_id  -- Child is NOT the provider's own child
    )
);
```

### 2. Regular Decline Section (lines 658-673)

When a regular reschedule is declined, same logic:

```sql
-- Cancel block if it was the ONLY child OR only has providing parent's own child left
IF v_children_count_before = 1 OR NOT EXISTS (
    SELECT 1 FROM scheduled_care_children scc
    JOIN children c ON scc.child_id = c.id
    JOIN scheduled_care sc ON scc.scheduled_care_id = sc.id
    WHERE scc.scheduled_care_id = v_providing_block_id
    AND c.parent_id != sc.parent_id  -- Has at least one child that's NOT the provider's own
) THEN
    RAISE NOTICE 'Block is empty or only has provider own child - cancelling entire providing block';
    UPDATE scheduled_care
    SET status = 'cancelled', action_type = 'cancelled'
    WHERE id = v_providing_block_id;
```

## Key Concept

**Valid providing block**: Must have at least ONE child that does NOT belong to the providing parent
- ✅ Karen provides care to: Karen, Rosmary → VALID (has Rosmary's child)
- ✅ Karen provides care to: Karen, Bruce, Hugo → VALID (has Bruce and Hugo's children)
- ❌ Karen provides care to: Karen only → INVALID (only her own child)
- ❌ Empty block with no children → INVALID

## Test Cases

### Test 1: Counter declined, block has other parents' children
- **Setup**: Karen's block has Karen, Rosmary, Bruce
- **Action**: Rosmary declines Karen's counter
- **Result**: Karen's block remains with Karen, Bruce ✅

### Test 2: Counter declined, block only has provider's child
- **Setup**: Karen's block has Karen, Rosmary
- **Action**: Rosmary declines Karen's counter
- **Result**: Karen's block is deleted ✅

### Test 3: Counter declined, block becomes empty
- **Setup**: Karen's block only has Rosmary's child (unusual case)
- **Action**: Rosmary declines Karen's counter
- **Result**: Karen's block is deleted ✅

### Test 4: Regular decline, block only has provider's child
- **Setup**: Karen's block has Karen, Rosmary
- **Action**: Rosmary declines original reschedule
- **Result**: Karen's block is deleted ✅

## Files Updated

- `DEPLOY_FIXED_handle_improved_reschedule_response_v2.sql` (794 lines)
  - Lines 500-523: Counter-decline self-only block removal
  - Lines 658-673: Regular decline self-only block removal
