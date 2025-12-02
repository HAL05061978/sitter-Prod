# Decline Notification Fix: Correct Block Display

## Issue Found
Both cancelled blocks were showing the same date (Nov 3) instead of showing:
1. **Declined reschedule:** Nov 3 (the original block being rescheduled)
2. **Selected cancellation:** Nov 5 (the open block that was selected to be removed)

## Root Cause

The `care_requests` table uses **different field structures** for different request types:

### For Reschedule/Reciprocal Requests:
- `requested_date`, `start_time`, `end_time` = the NEW date being requested
- `reciprocal_date`, `reciprocal_start_time`, `reciprocal_end_time` = the ORIGINAL date

### For Open Block Requests:
- `requested_date`, `start_time`, `end_time` = the acceptance/offer date (not the care date!)
- `reciprocal_date`, `reciprocal_start_time`, `reciprocal_end_time` = the **ACTUAL care date**

## The Problem

When querying the selected cancellation request, the SQL was using:
```sql
SELECT requested_date FROM care_requests WHERE id = p_selected_cancellation_request_id
```

This worked for reschedule/reciprocal requests, but for **open_block** requests, it returned the offer date (Nov 3) instead of the actual care date (Nov 5).

## The Fix

Updated the SQL to use CASE statements that check the `request_type`:

```sql
'selected_cancellation_date', (
    SELECT CASE
        WHEN request_type = 'open_block' THEN reciprocal_date
        ELSE requested_date
    END
    FROM care_requests WHERE id = p_selected_cancellation_request_id
),
'selected_cancellation_start_time', (
    SELECT CASE
        WHEN request_type = 'open_block' THEN reciprocal_start_time
        ELSE start_time
    END
    FROM care_requests WHERE id = p_selected_cancellation_request_id
),
'selected_cancellation_end_time', (
    SELECT CASE
        WHEN request_type = 'open_block' THEN reciprocal_end_time
        ELSE end_time
    END
    FROM care_requests WHERE id = p_selected_cancellation_request_id
)
```

## Example from CSV Data

**care_requests.csv row 2 (open_block 05ea6ef6-669d-415b-aee6-8c46f1d6e8b9):**
- `request_type`: open_block
- `requested_date`: 2025-11-03 (offer date - WRONG to use)
- `reciprocal_date`: 2025-11-05 (actual care date - CORRECT)
- `reciprocal_start_time`: 13:00:00
- `reciprocal_end_time`: 17:00:00

**care_responses.csv row 8:**
- `selected_cancellation_request_id`: 05ea6ef6-669d-415b-aee6-8c46f1d6e8b9

**Result:**
- Before fix: Showed Nov 3, 2025 (wrong)
- After fix: Shows Nov 5, 2025 (correct)

## What Users Will Now See

When a parent declines a reschedule and selects an open block to cancel:

**Cancelled care blocks:**

┌─────────────────────────────────┐
│ Declined reschedule             │
│ Nov 3, 2025 from 8:00 PM to    │
│ 9:00 PM                         │
└─────────────────────────────────┘

┌─────────────────────────────────┐
│ Selected arrangement removed    │
│ Nov 5, 2025 from 1:00 PM to    │  ← Now shows correct date!
│ 5:00 PM                         │
└─────────────────────────────────┘

## Files Updated

1. `DEPLOY_RESCHEDULE_DECLINE_NOTIFICATIONS_PHASE2.sql` - Both notification INSERTs updated with CASE statements

## Testing Required

Test scenarios where the selected cancellation is:
- [ ] Open block (should show reciprocal_date)
- [ ] Reciprocal request (should show requested_date)
- [ ] Another reschedule request (should show requested_date)

## Build Status
Frontend unchanged - no rebuild needed. Backend SQL ready for deployment.
