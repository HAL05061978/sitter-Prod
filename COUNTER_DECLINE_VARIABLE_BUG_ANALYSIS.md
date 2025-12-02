# Counter Decline Variable Overwrite Bug - Analysis & Fix

## The Bug

When declining a counter-proposal, the wrong children were being removed from blocks, causing the yellow rescheduled blocks and selected cancellation blocks to persist incorrectly.

## Root Cause

**Variable Overwrite on Line 600**

The code was reusing the `v_requester_child_id` variable for two different purposes:

1. **Line 562**: Uses `v_requester_child_id` = Counter-proposer's child (to remove from yellow blocks) ✅
2. **Line 600**: **OVERWRITES** `v_requester_child_id` = Original rescheduler's child
3. **Line 612**: Uses the overwritten value (wrong child!) to remove from selected cancellation blocks ❌
4. **Line 630**: Uses the overwritten value again (wrong child!) ❌

## Your Scenario

**Players:**
- **Original Rescheduler (Maghan)**: ID `88416767`, child Ella (`5f093c84`)
  - Wanted to reschedule Nov 4 → Nov 11
- **Counter-Proposer (Rosmary)**: ID `1f66fb72`, child Gia (`24015a99`)
  - Declined and offered Nov 12 counter
  - Selected cancellation: `7bc98357` (Nov 5 reciprocal care)

**What SHOULD happen when Maghan declines Rosmary's counter:**
1. Remove **Rosmary's child (Gia)** from yellow rescheduled blocks at Nov 4
2. Remove **Maghan's child (Ella)** from selected cancellation blocks at Nov 5

**What WAS happening (with bug):**
1. Remove **Rosmary's child (Gia)** from yellow rescheduled blocks at Nov 4 ✅
2. Line 600 overwrites variable with Maghan's child (Ella)
3. Try to remove **Maghan's child (Ella)** from selected cancellation blocks - but it was never there! ❌
4. Result: Maghan's child stays in yellow blocks, Rosmary's blocks don't get cleaned up

## The Fix

Changed 3 lines to use a separate variable `v_original_rescheduler_child_id`:

### Line 69 (Variable Declaration):
```sql
-- BEFORE:
v_original_reschedule_requester_id UUID;  -- For counter-decline fix

-- AFTER:
v_original_rescheduler_child_id UUID;  -- ✅ FIX: For original rescheduler's child in counter-decline
```

### Line 600 (Getting Original Rescheduler's Child):
```sql
-- BEFORE:
SELECT child_id INTO v_requester_child_id
FROM care_requests
WHERE id = v_care_request.counter_proposal_to
LIMIT 1;

-- AFTER:
SELECT child_id INTO v_original_rescheduler_child_id
FROM care_requests
WHERE id = v_care_request.counter_proposal_to
LIMIT 1;
```

### Line 612 (Removing from Providing Blocks):
```sql
-- BEFORE:
AND scc.child_id = v_requester_child_id;

-- AFTER:
AND scc.child_id = v_original_rescheduler_child_id;
```

### Line 630 (Removing from Needed Blocks):
```sql
-- BEFORE:
AND scc.child_id = v_requester_child_id;

-- AFTER:
AND scc.child_id = v_original_rescheduler_child_id;
```

## Variable Usage After Fix

**`v_requester_child_id`** (Counter-proposer's child):
- Set once at the beginning
- Used on line 562 to remove from yellow rescheduled blocks
- **Never overwritten**

**`v_original_rescheduler_child_id`** (Original rescheduler's child):
- Set on line 600 from the original reschedule request
- Used on lines 612, 630 to remove from selected cancellation blocks
- **Separate from counter-proposer's child**

## Files

- **Original (buggy)**: `DEPLOY_RESCHEDULE_DECLINE_NOTIFICATIONS_PHASE2.sql`
- **Fixed version**: `DEPLOY_RESCHEDULE_DECLINE_NOTIFICATIONS_PHASE2_FIXED.sql`
- **Patch documentation**: `DEPLOY_FIX_COUNTER_DECLINE_VARIABLE_BUG.sql`

## Testing After Deployment

After deploying the fixed SQL:

1. **Start fresh** - Have Maghan reschedule Nov 4 block to Nov 11
2. **Counter** - Have Rosmary decline with counter for Nov 12, select the Nov 5 reciprocal block
3. **Decline counter** - Have Maghan decline Rosmary's counter
4. **Verify:**
   - ✅ Rosmary's child (Gia) removed from ALL Nov 4 yellow blocks
   - ✅ Maghan's child (Ella) removed from ALL Nov 5 blocks (the selected cancellation)
   - ✅ Both parents see decline notifications
   - ✅ No yellow blocks remain on calendars
   - ✅ No orphaned needed blocks without parent's own child

## Deployment

Run the entire `DEPLOY_RESCHEDULE_DECLINE_NOTIFICATIONS_PHASE2_FIXED.sql` file in Supabase SQL Editor.
