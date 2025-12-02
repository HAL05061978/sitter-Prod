# Reschedule Constraints Fix

## Problem

When trying to reschedule a block that has open block invited parents/children, the system throws database constraint errors:

**Error 1: action_type constraint**
```
code: '23514'
message: 'new row for relation "care_requests" violates check constraint "care_requests_action_type_check"'
```

**Error 2: request_type constraint** (after fixing Error 1)
```
code: '23514'
message: 'new row for relation "care_requests" violates check constraint "care_requests_request_type_check"'
```

## Root Cause

The `initiate_improved_reschedule` function has TWO constraint mismatches:

### 1. action_type Mismatch
The function sets `action_type = 'reschedule'`, but the constraint only allows:
- `'new'`
- `'open_block_invitation'`
- `'reschedule_request'`
- `'reschedule_counter'`
- `'hangout_invitation'`
- `'sleepover_invitation'`

### 2. request_type Mismatch
The function sets `request_type = 'reschedule'`, but the constraint only allows:
- `'reciprocal'`
- `'open_block'`
- `'event'`
- `'hangout'`
- `'sleepover'`

The generic `'reschedule'` value was missing from BOTH constraints!

## Solution

The fix involves THREE critical changes:

### 1. Update the request_type Constraint

Added `'reschedule'` to the allowed values:

```sql
ALTER TABLE care_requests
ADD CONSTRAINT care_requests_request_type_check
CHECK (
  request_type IN (
    'reciprocal',
    'open_block',
    'event',
    'hangout',
    'sleepover',
    'reschedule'              -- CRITICAL: Add reschedule as valid request_type
  )
  OR request_type IS NULL
);
```

### 2. Update the action_type Constraint

Added `'reschedule'` and related values to the allowed list:

```sql
ALTER TABLE care_requests
ADD CONSTRAINT care_requests_action_type_check
CHECK (
  action_type IN (
    'new',
    'reschedule',              -- Keep for backward compatibility
    'reschedule_request',      -- New: initial reschedule request
    'reschedule_counter',      -- New: counter-proposal to reschedule
    'cancellation',
    'open_block_invitation',
    'hangout_invitation',
    'sleepover_invitation',
    'rescheduled'              -- For scheduled_care blocks marked as rescheduled
  )
  OR action_type IS NULL
);
```

### 3. Deploy the Complete Function

The migration includes the complete `initiate_improved_reschedule` function that uses:
- `request_type = 'reschedule'` (now allowed)
- `action_type = 'reschedule_request'` (now allowed)

## Deployment Steps

### Option 1: Supabase Dashboard (Recommended)

1. Go to https://hilkelodfneancwwzvoh.supabase.co
2. Navigate to **SQL Editor**
3. Create a new query
4. Copy the contents of `supabase\supabase\migrations\20251024120000_fix_reschedule_action_type.sql`
5. Paste and execute the SQL

### Option 2: Command Line

If you have your Supabase database password:

```bash
npx supabase db push --db-url "postgresql://postgres:[YOUR_PASSWORD]@db.hilkelodfneancwwzvoh.supabase.co:5432/postgres"
```

## Verification

After deployment, you can verify the fix by:

1. Attempting to reschedule a block with open block invited parents
2. The reschedule should complete without the constraint error
3. Check `care_requests` table to confirm `action_type = 'reschedule_request'`

## Files Changed

- ✅ Created: `supabase\supabase\migrations\20251024120000_fix_reschedule_action_type.sql`
- ✅ Created: `deploy-reschedule-fix.bat` (deployment helper)
- ✅ Created: `RESCHEDULE_ACTION_TYPE_FIX.md` (this documentation)

## Related Files

- `components\care\RescheduleModal.tsx` - Frontend component that calls the function
- `COMPLETE_FIX_reschedule_workflow.sql` - Original (undeployed) function definition
- `supabase\supabase\migrations\20250115000014_add_care_reschedule_functionality.sql` - Original migration with old constraint

## Impact

This fix resolves:
- ✅ Reschedule requests failing with `action_type` constraint error
- ✅ Reschedule requests failing with `request_type` constraint error
- ✅ Blocks with open block invited parents can now be rescheduled
- ✅ Both constraints now include all necessary values
- ✅ Complete function properly deployed to migrations folder

## Testing Recommendations

1. **Test reschedule without open block**: Standard reciprocal block reschedule
2. **Test reschedule with open block**: Block with accepted open block invitations
3. **Test counter-proposal**: Ensure counter-proposals still work correctly
4. **Check database**: Verify action_type values in care_requests table
