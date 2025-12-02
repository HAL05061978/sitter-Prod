# Deploy Hangout Provider Fix

## Problem
Hangout and sleepover invitations show "Unknown" as the provider in the calendar UI.

## Root Cause
The `create_hangout_invitation` and `create_sleepover_invitation` functions are not setting `providing_parent_id` when inserting children into the `scheduled_care_children` table.

## Solution
Apply the migration file: `migrations/20250122000007_fix_hangout_providing_parent.sql`

## Deployment Steps

### Option 1: Supabase Dashboard (RECOMMENDED)

1. Go to your Supabase project dashboard
2. Navigate to: **SQL Editor** (left sidebar)
3. Click **"New query"**
4. Open the file: `C:\Users\admin\SitterAp\sitter-Prod\migrations\20250122000007_fix_hangout_providing_parent.sql`
5. Copy the ENTIRE contents (all 319 lines)
6. Paste into the SQL Editor
7. Click **"Run"** (or press Ctrl+Enter)
8. Verify you see success messages

### Option 2: Command Line (if you have direct database access)

```bash
cd "C:\Users\admin\SitterAp\sitter-Prod"

# If you have psql and DATABASE_URL configured:
psql $DATABASE_URL -f migrations/20250122000007_fix_hangout_providing_parent.sql
```

## What This Fix Does

### Changes to `create_hangout_invitation`:
- **Line 121-122**: Now sets `providing_parent_id` when adding hosting children
- **Before**: `INSERT INTO scheduled_care_children (scheduled_care_id, child_id)`
- **After**: `INSERT INTO scheduled_care_children (scheduled_care_id, child_id, providing_parent_id)`

### Changes to `create_sleepover_invitation`:
- **Line 279-280**: Now sets `providing_parent_id` when adding hosting children
- **Before**: `INSERT INTO scheduled_care_children (scheduled_care_id, child_id)`
- **After**: `INSERT INTO scheduled_care_children (scheduled_care_id, child_id, providing_parent_id)`

## Impact Analysis

✅ **SAFE - No breaking changes:**
- **Reciprocal care**: Uses different logic - NOT affected
- **Open blocks**: Uses different logic - NOT affected
- **Events**: Uses different logic - NOT affected
- **Hangout/Sleepover**: ONLY care type affected - this is the fix!

## Testing After Deployment

1. Create a new hangout invitation
2. Accept the invitation
3. View the calendar for Nov 1 (or the hangout date)
4. Verify the provider name shows the host's name instead of "Unknown"

## Rollback (if needed)

If you need to rollback, revert to the previous version:
`migrations/20250122000001_add_hangout_sleepover_schema.sql`

However, this should not be necessary as the fix is backward compatible.

## Files Modified
- `create_hangout_invitation()` function
- `create_sleepover_invitation()` function

## No UI Changes Required
The calendar UI already has the correct logic to display the provider name. It's just waiting for the database to populate the field.
