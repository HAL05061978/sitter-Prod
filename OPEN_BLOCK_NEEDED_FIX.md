# Open Block Needed Blocks Fix

## The Final Issue

**Problem**: When Rosmary declines a counter-proposal, her child was being removed from Hugo's providing block (✅), but NOT from Bruce and Karen's needed blocks (❌).

**Root Cause**: Bruce and Karen's needed blocks come from **open block acceptances**, so they have different `related_request_id` values. The code was only looking for blocks with the selected arrangement's `related_request_id`, missing these open block invitation blocks.

## Example

### Setup
```
Hugo ↔ Rosmary original reciprocal (Oct 27 07:30-11:30)
- Hugo's providing block: related_request_id = 9094e3df... (original reciprocal)
- Rosmary's needed block: related_request_id = 9094e3df... (original reciprocal)

Hugo opens his block to Bruce and Karen (they accept)
- Hugo's providing block: still 9094e3df... (unchanged)
- Bruce's needed block: related_request_id = d1d8007e... (Bruce's open block acceptance)
- Karen's needed block: related_request_id = 31bd29ed... (Karen's open block acceptance)
```

### The Problem

When we tried to remove Rosmary's child using:
```sql
DELETE FROM scheduled_care_children scc
USING scheduled_care sc
WHERE sc.related_request_id = v_counter_proposer_selected_arrangement  -- 9094e3df...
AND sc.care_type = 'needed'
AND scc.child_id = v_requester_child_id;
```

This would find:
- ✅ Rosmary's needed block (related_request_id = 9094e3df)
- ❌ Bruce's needed block (related_request_id = d1d8007e) - **MISSED!**
- ❌ Karen's needed block (related_request_id = 31bd29ed) - **MISSED!**

## The Solution

Instead of matching by `related_request_id`, match by **date, time, and group** - because all these blocks (Hugo's providing, Bruce's needed, Karen's needed) are at the same time slot.

### Step 2: Remove child from needed blocks (NEW - lines 470-485)

```sql
-- Match by date/time since open block needed blocks have different related_request_id
DELETE FROM scheduled_care_children scc
USING scheduled_care sc, care_requests cr
WHERE scc.scheduled_care_id = sc.id
AND cr.id = v_counter_proposer_selected_arrangement
AND sc.group_id = cr.group_id
AND sc.care_date = cr.requested_date      -- Match by date
AND sc.start_time = cr.start_time          -- Match by start time
AND sc.end_time = cr.end_time              -- Match by end time
AND sc.status != 'rescheduled'
AND sc.care_type = 'needed'
AND scc.child_id = v_requester_child_id;
```

Now this finds ALL needed blocks at that time:
- ✅ Rosmary's needed block (Oct 27 07:30-11:30)
- ✅ Bruce's needed block (Oct 27 07:30-11:30) - **FOUND!**
- ✅ Karen's needed block (Oct 27 07:30-11:30) - **FOUND!**

### Step 3: Delete meaningless needed blocks (lines 487-516)

Same approach - match by date/time:

```sql
DELETE FROM scheduled_care sc
USING care_requests cr
WHERE cr.id = v_counter_proposer_selected_arrangement
AND sc.group_id = cr.group_id
AND sc.care_date = cr.requested_date
AND sc.start_time = cr.start_time
AND sc.end_time = cr.end_time
AND sc.care_type = 'needed'
AND sc.status != 'rescheduled'
AND (
    NOT EXISTS (SELECT 1 FROM scheduled_care_children scc WHERE scc.scheduled_care_id = sc.id)
    OR
    NOT EXISTS (
        SELECT 1 FROM scheduled_care_children scc
        JOIN children c ON scc.child_id = c.id
        WHERE scc.scheduled_care_id = sc.id
        AND c.parent_id = sc.parent_id
    )
);
```

### Step 4: Cancel providing blocks (lines 518-547)

Also updated to use date/time matching for consistency:

```sql
UPDATE scheduled_care sc
SET status = 'cancelled', action_type = 'cancelled'
FROM care_requests cr
WHERE cr.id = v_counter_proposer_selected_arrangement
AND sc.group_id = cr.group_id
AND sc.care_date = cr.requested_date
AND sc.start_time = cr.start_time
AND sc.end_time = cr.end_time
AND sc.status != 'rescheduled'
AND sc.care_type = 'provided'
AND (...meaningless block checks...);
```

## Why This Works

The key insight: **All related blocks occur at the same time slot**

- Hugo's providing block: Oct 27 07:30-11:30
- Rosmary's needed block: Oct 27 07:30-11:30
- Bruce's needed block: Oct 27 07:30-11:30 (from open block)
- Karen's needed block: Oct 27 07:30-11:30 (from open block)

Even though they have different `related_request_id` values, they all share the same date/time. So we can find all related blocks by matching on:
- `group_id` - same care exchange group
- `care_date` - same date
- `start_time` - same start time
- `end_time` - same end time

## Expected Results After Fix

When Rosmary declines Hugo's counter:

**Hugo's calendar:**
```
╔═══════════════════════════════════╗
║  PROVIDING (Oct 27 07:30-11:30)   ║
╠═══════════════════════════════════╣
║  • Hugo (own child)                ║
║  • Bruce                           ║
║  • Karen                           ║
╚═══════════════════════════════════╝
✅ Rosmary's child removed
```

**Bruce's calendar:**
```
╔═══════════════════════════════════╗
║  NEEDED (Oct 27 07:30-11:30)      ║
║  Provider: Hugo                    ║
╠═══════════════════════════════════╣
║  • Hugo                            ║
║  • Bruce (own child)               ║
║  • Karen                           ║
╚═══════════════════════════════════╝
✅ Rosmary's child removed
```

**Karen's calendar:**
```
╔═══════════════════════════════════╗
║  NEEDED (Oct 27 07:30-11:30)      ║
║  Provider: Hugo                    ║
╠═══════════════════════════════════╣
║  • Hugo                            ║
║  • Bruce                           ║
║  • Karen (own child)               ║
╚═══════════════════════════════════╝
✅ Rosmary's child removed
```

**Rosmary's calendar:**
```
(No blocks - all deleted)
✅ No blocks showing
```

## Files Updated

- `DEPLOY_FIXED_handle_improved_reschedule_response_v2.sql` (845 lines)
  - Lines 470-485: Remove child from needed blocks (date/time matching)
  - Lines 487-516: Delete meaningless needed blocks (date/time matching)
  - Lines 518-547: Cancel meaningless providing blocks (date/time matching)

## Key Takeaway

When dealing with **open block invitations**, you can't rely on `related_request_id` alone because:
- The providing block has the original reciprocal's request ID
- Each accepting parent's needed block has their own open block acceptance request ID

Use **date/time matching** to find all related blocks at the same time slot!
