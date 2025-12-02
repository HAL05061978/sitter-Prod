# Reciprocal Time Fix - Critical Understanding

## The Bug

When using date/time matching to find blocks, I was incorrectly using:
- `cr.requested_date`
- `cr.start_time`
- `cr.end_time`

This caused nothing to happen because these fields contain the **NEW** reschedule time, not the **ORIGINAL** time!

## The Fix

Use the reciprocal fields instead:
- `cr.reciprocal_date` ✅
- `cr.reciprocal_start_time` ✅
- `cr.reciprocal_end_time` ✅

## Why This Matters

### Care Request Structure for Reschedules

When a reschedule request is created:

```sql
-- Rosmary requests to reschedule Oct 27 07:30-11:30 to Nov 1 15:30-20:30
care_requests:
  requested_date: 2025-11-01       -- NEW time (where they want to go)
  start_time: 15:30:00
  end_time: 20:30:00

  reciprocal_date: 2025-10-27      -- ORIGINAL time (what's being rescheduled)
  reciprocal_start_time: 07:30:00
  reciprocal_end_time: 11:30:00
```

### When Hugo Counters

Hugo's counter-proposal:
```sql
care_requests:
  requested_date: 2025-11-02       -- Hugo's proposed time
  start_time: 16:00:00
  end_time: 20:00:00

  reciprocal_date: 2025-10-27      -- Still the ORIGINAL time
  reciprocal_start_time: 07:30:00
  reciprocal_end_time: 11:30:00
```

### When Counter is Declined

Hugo selected `v_counter_proposer_selected_arrangement` = the original reciprocal request (Oct 27 blocks).

We need to find all blocks at **Oct 27 07:30-11:30**, which are stored in the selected arrangement's **RECIPROCAL** fields!

## The Fix Applied (Lines 470-548)

### Step 2: Remove child from needed blocks
```sql
DELETE FROM scheduled_care_children scc
USING scheduled_care sc, care_requests cr
WHERE scc.scheduled_care_id = sc.id
AND cr.id = v_counter_proposer_selected_arrangement
AND sc.care_date = cr.reciprocal_date           -- ✅ CORRECT
AND sc.start_time = cr.reciprocal_start_time    -- ✅ CORRECT
AND sc.end_time = cr.reciprocal_end_time        -- ✅ CORRECT
```

### Step 3: Delete meaningless needed blocks
```sql
DELETE FROM scheduled_care sc
USING care_requests cr
WHERE cr.id = v_counter_proposer_selected_arrangement
AND sc.care_date = cr.reciprocal_date           -- ✅ CORRECT
AND sc.start_time = cr.reciprocal_start_time    -- ✅ CORRECT
AND sc.end_time = cr.reciprocal_end_time        -- ✅ CORRECT
```

### Step 4: Cancel meaningless providing blocks
```sql
UPDATE scheduled_care sc
SET status = 'cancelled', action_type = 'cancelled'
FROM care_requests cr
WHERE cr.id = v_counter_proposer_selected_arrangement
AND sc.care_date = cr.reciprocal_date           -- ✅ CORRECT
AND sc.start_time = cr.reciprocal_start_time    -- ✅ CORRECT
AND sc.end_time = cr.reciprocal_end_time        -- ✅ CORRECT
```

## Key Takeaway

**When working with "selected arrangement to cancel":**
- This is always the ORIGINAL blocks being kept/cancelled
- Use `reciprocal_date/start_time/end_time` from the care request
- NOT `requested_date/start_time/end_time` (those are the NEW times)

**Mental model:**
- `requested_*` = "Where we want to go" (NEW time)
- `reciprocal_*` = "What we're giving up" (ORIGINAL time)
- Selected arrangement = The ORIGINAL blocks = Use `reciprocal_*` fields!
