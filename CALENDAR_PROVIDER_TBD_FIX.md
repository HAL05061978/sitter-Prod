# Calendar Provider Showing "TBD" After Open Block Acceptance

## Problem

After accepting an open block invitation, the accepting parent's **receiving care block** shows provider as **"TBD"** instead of the actual provider name.

### Example Scenario

1. Bruce opens a providing block at 2025-10-25 07:30-11:30
2. Karen accepts the open block invitation
3. Karen gets a receiving block at same date/time
4. **Problem**: Karen's receiving block shows "Provider: TBD" instead of "Provider: Bruce"

### What Works

- ✅ Karen's **providing block** at reciprocal time shows correct provider (Karen)
- ✅ Bruce's original **providing block** shows correct provider (Bruce)
- ❌ Karen's **receiving block** at opened time shows "TBD"

## Root Cause

The calendar query `get_scheduled_care_for_calendar` tries to find the provider name like this:

```sql
WHEN sc.care_type = 'needed' THEN
    (SELECT provider_profile.full_name
     FROM scheduled_care provider_care
     JOIN profiles provider_profile ON provider_care.parent_id = provider_profile.id
     WHERE provider_care.group_id = sc.group_id
     AND provider_care.care_date = sc.care_date
     AND provider_care.start_time = sc.start_time
     AND provider_care.end_time = sc.end_time
     AND provider_care.care_type = 'provided'
     AND provider_care.related_request_id = sc.related_request_id  -- ❌ This fails!
     AND provider_care.parent_id != sc.parent_id
     LIMIT 1)
```

**The problem**: It's looking for a `provided` block with the same `related_request_id`, but for open blocks:
- Karen's receiving block: `related_request_id = ae2e719e` (open block request)
- Bruce's providing block: `related_request_id = d63437bc` (original reciprocal request)

These don't match! Bruce's providing block was created from the **original** reciprocal request, not from the open block request.

## The Real Location of Provider

The provider information IS in the database, just in a different place:

From `scheduled_care_children.csv`:
```
scheduled_care_id: e00ed752 (Karen's receiving block)
providing_parent_id: 1f66fb72 (Bruce) ✅
```

The `scheduled_care_children` table has `providing_parent_id` which correctly stores Bruce's ID!

## Solution

Update the calendar query to check `scheduled_care_children.providing_parent_id` **FIRST**, then fall back to the `related_request_id` matching:

```sql
WHEN sc.care_type = 'needed' THEN
    COALESCE(
        -- PRIORITY 1: Get provider from scheduled_care_children
        (SELECT DISTINCT provider_profile.full_name
         FROM scheduled_care_children scc_provider
         JOIN profiles provider_profile ON scc_provider.providing_parent_id = provider_profile.id
         WHERE scc_provider.scheduled_care_id = sc.id
         LIMIT 1),
        -- PRIORITY 2: Fall back to related_request_id matching
        (SELECT provider_profile.full_name
         FROM scheduled_care provider_care
         ...
         AND provider_care.related_request_id = sc.related_request_id
         ...),
        'TBD'
    )
```

This way:
- ✅ Open blocks: Gets provider from `scheduled_care_children.providing_parent_id`
- ✅ Regular blocks: Falls back to `related_request_id` matching
- ✅ Both work correctly!

## Migration File

Created: `supabase\supabase\migrations\20251024120300_fix_calendar_provider_from_children.sql`

## Deployment

### Run This Migration

1. Go to https://hilkelodfneancwwzvoh.supabase.co
2. Navigate to **SQL Editor**
3. Copy the contents of:
   ```
   supabase\supabase\migrations\20251024120300_fix_calendar_provider_from_children.sql
   ```
4. Paste and execute

## Verification

After deployment, check Karen's receiving block:

```sql
-- Test the calendar function
SELECT
    care_date,
    start_time,
    end_time,
    care_type,
    providing_parent_name,  -- Should show "Bruce" not "TBD"
    children_names
FROM get_scheduled_care_for_calendar(
    '<KAREN_PARENT_ID>',
    '2025-10-25',
    '2025-10-25'
);
```

**Expected Result**:
- Block at 2025-10-25 07:30-11:30
- `care_type`: 'needed'
- `providing_parent_name`: **"Bruce"** (not "TBD")
- `children_names`: {Bruce's child, Karen's child, ...}

## Impact

This fix resolves:
- ✅ Open block receiving blocks show correct provider name
- ✅ Regular reciprocal blocks continue to work (fall back logic)
- ✅ Provider name sourced from `scheduled_care_children` first
- ✅ "TBD" only shows when provider truly unknown

## Complete Migration Sequence

To fix the entire reschedule + open block workflow, deploy these migrations in order:

1. ✅ `20251024120000_fix_reschedule_action_type.sql` - Constraint fixes
2. ✅ `20251024120100_fix_calendar_show_rescheduled_blocks.sql` - Show yellow blocks
3. ✅ `20251024120200_deploy_handle_improved_reschedule_response.sql` - Add children to new blocks
4. ✅ **`20251024120300_fix_calendar_provider_from_children.sql`** - Fix provider names ⭐

After all four migrations, your system will:
- ✅ Accept reschedules without constraint errors
- ✅ Show yellow blocks during pending reschedule
- ✅ Add all children to new blocks on acceptance
- ✅ Display correct provider names for all block types
