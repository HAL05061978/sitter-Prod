# Calendar Not Showing Rescheduled (Yellow) Blocks Fix

## Problem

After successfully creating a reschedule request, the blocks that should turn yellow and show the children whose parents haven't responded are **disappearing from the calendar entirely**.

### Error Sequence

1. ✅ Reschedule constraints fixed (request_type and action_type)
2. ✅ Reschedule request created successfully
3. ✅ Blocks marked as `status='rescheduled'` and `action_type='rescheduled'` in database
4. ✅ Children properly preserved in `scheduled_care_children`
5. ❌ **Calendar UI shows no blocks** - blocks disappeared!

## Root Cause

The calendar query function `get_scheduled_care_for_calendar` has this filter on line 77:

```sql
AND sc.status = 'confirmed'
```

This means the calendar **only shows confirmed blocks** and **hides rescheduled blocks**!

When `initiate_improved_reschedule` marks blocks as `status='rescheduled'`, they become invisible to the calendar query.

## Database State Analysis

### Yellow Blocks Created Correctly ✅

From `scheduled_care_OpenRescheduleSent.csv`:

| ID | Parent | Date | Time | Type | Status | Action Type | Children |
|----|--------|------|------|------|--------|-------------|----------|
| faa833eb | Rosmary | 2025-10-25 | 07:30-11:30 | provided | **rescheduled** | **rescheduled** | Bruce, Hugo, Karen |
| 8c39ce7d | Bruce | 2025-10-25 | 07:30-11:30 | needed | **rescheduled** | **rescheduled** | (from scc) |
| f50ef7d4 | Hugo | 2025-10-25 | 07:30-11:30 | needed | **rescheduled** | **rescheduled** | (from scc) |
| 26e79451 | Karen | 2025-10-25 | 07:30-11:30 | needed | **rescheduled** | **rescheduled** | (from scc) |

### Children Preserved Correctly ✅

From `scheduled_care_children_OpenRescheduleSent.csv`:

The yellow providing block (`faa833eb`) contains:
- Row 26: Bruce's child (24015a99)
- Row 27: Hugo's child (3d9d40ea)
- Row 28: Karen's child (a42af785)

**All receiving children are present!** ✅

### Calendar Query Filtering Them Out ❌

```sql
-- Current query
WHERE sc.parent_id = p_parent_id
AND sc.care_date BETWEEN p_start_date AND p_end_date
AND sc.status = 'confirmed'  -- ❌ This excludes 'rescheduled' blocks!
```

## Solution

Update `get_scheduled_care_for_calendar` to include rescheduled blocks:

### Changes Made

1. **Include rescheduled status**:
   ```sql
   AND sc.status IN ('confirmed', 'rescheduled')
   ```

2. **Return action_type field**:
   Added `action_type` to the return columns so the UI can apply orange styling

3. **Fix children aggregation**:
   Added `FILTER (WHERE c.full_name IS NOT NULL)` to handle NULL children gracefully

## Migration File

Created: `supabase\supabase\migrations\20251024120100_fix_calendar_show_rescheduled_blocks.sql`

## Deployment

### Step 1: Deploy Constraint Fixes (if not already done)

```sql
-- Run this first:
supabase\supabase\migrations\20251024120000_fix_reschedule_action_type.sql
```

This fixes the `request_type` and `action_type` constraints.

### Step 2: Deploy Calendar Fix

1. Go to https://hilkelodfneancwwzvoh.supabase.co
2. Navigate to **SQL Editor**
3. Copy the contents of:
   ```
   supabase\supabase\migrations\20251024120100_fix_calendar_show_rescheduled_blocks.sql
   ```
4. Paste and execute

## Verification

After deployment:

1. **Check existing reschedule**: The yellow blocks at 2025-10-25 07:30-11:30 should now appear
2. **Verify children**: The blocks should show the children whose parents haven't responded
3. **Check styling**: Blocks should appear **orange** with "🔄 RESCHEDULING" label
4. **Create new reschedule**: Try rescheduling another block to verify it works end-to-end

## Expected Calendar Display

### For Rosmary (Provider)

**Providing Block** at 2025-10-25 07:30-11:30:
- Color: **Orange** (rescheduled)
- Label: **🔄 RESCHEDULING**
- Children shown:
  - Bruce's child (pending response)
  - Hugo's child (pending response)
  - Karen's child (pending response)
- Note: Rosmary's own child removed (correct per design - provider child not in yellow block)

### For Bruce, Hugo, Karen (Receiving Parents)

**Receiving Block** at 2025-10-25 07:30-11:30:
- Color: **Orange** (rescheduled)
- Label: **🔄 RESCHEDULING**
- Children: Their own child(ren)
- Provider: Rosmary

## Files Changed

- ✅ Created: `supabase\supabase\migrations\20251024120000_fix_reschedule_action_type.sql`
- ✅ Created: `supabase\supabase\migrations\20251024120100_fix_calendar_show_rescheduled_blocks.sql`
- ✅ Created: `CALENDAR_RESCHEDULED_BLOCKS_FIX.md` (this documentation)
- ✅ Updated: `RESCHEDULE_ACTION_TYPE_FIX.md`

## Related Issues

### Issue 1: Constraint Errors
- **Problem**: `request_type` and `action_type` constraints missing 'reschedule' values
- **Fix**: `20251024120000_fix_reschedule_action_type.sql`
- **Status**: ✅ Fixed

### Issue 2: Calendar Not Showing Yellow Blocks
- **Problem**: Calendar query filters out `status='rescheduled'` blocks
- **Fix**: `20251024120100_fix_calendar_show_rescheduled_blocks.sql`
- **Status**: ✅ Fixed

## Complete Fix Summary

To fully fix reschedule with open block invited parents:

1. ✅ Add `'reschedule'` to `request_type` constraint
2. ✅ Add `'reschedule_request'` to `action_type` constraint
3. ✅ Deploy `initiate_improved_reschedule` function
4. ✅ Update calendar query to include `status='rescheduled'`
5. ✅ Return `action_type` for UI styling

After applying both migrations, the reschedule workflow will work completely!
