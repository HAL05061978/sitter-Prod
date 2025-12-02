# Fix Rescheduled Blocks Display - Complete Guide

## Problem
Rescheduled blocks (yellow/orange) disappeared from calendar after adding photo functionality.

## Root Cause
The `get_scheduled_care_for_calendar` function was missing the `action_type` field in both:
1. The RETURNS TABLE definition
2. The SELECT statement

Without `action_type`, the frontend couldn't determine which blocks were rescheduled.

## Database State (Confirmed Working)
From your CSV files, rescheduled blocks exist correctly:
- Block `e6810c9d-8b83-4358-a334-3d839b9994ea`: needed, status='rescheduled', action_type='rescheduled'
- Block `5a06437c-a970-4ea0-adbf-a1de07c24a49`: provided, status='rescheduled', action_type='rescheduled'

## Fixes Applied

### 1. Frontend Color Logic (ALREADY FIXED)
**File**: `app/calendar/page.tsx`
**Lines**: 1005, 1035

**Before**:
```typescript
if (actionType === 'rescheduled' && status === 'rescheduled')
```

**After**:
```typescript
if (actionType === 'rescheduled')
```

**Why**: The status field is 'rescheduled', not always matching. Just checking action_type is sufficient.

### 2. Database Function (NEEDS TO BE DEPLOYED)
**File**: `migrations/fix_calendar_function_add_action_type.sql`

**What it does**:
- Adds `action_type TEXT` to RETURNS TABLE
- Adds `sc.action_type` to SELECT statement
- Keeps all existing functionality:
  - Photo sharing logic
  - is_host detection
  - Children data
  - Provider name detection for open blocks
- Includes `status IN ('confirmed', 'rescheduled')` filter

## Deployment Steps

### Step 1: Run Database Migration
In Supabase Dashboard → SQL Editor, run:
```sql
-- migrations/fix_calendar_function_add_action_type.sql
```

This will:
- Drop the existing function
- Recreate it with `action_type` included
- Preserve all photo and hangout functionality

### Step 2: Verify Frontend
The frontend changes are already in place:
- ✅ Interface has `action_type?: string`
- ✅ Color functions check `actionType === 'rescheduled'`
- ✅ All photo upload functionality preserved

### Step 3: Test
1. **Check rescheduled blocks appear**:
   - Orange blocks should show on 10/31 for the rescheduled care

2. **Verify photos still work**:
   - Upload photo to a providing care block
   - Check receiving parent sees the photo

3. **Verify hangouts still work**:
   - Host should see green
   - Attendees should see blue

## Expected Behavior

### Rescheduled Block Colors
- **Original block** (10/31): Orange with label "Rescheduling"
- **New block** (10/30): Normal color (green for provided, blue for needed)

### Color Legend
- 🟢 **Green**: Providing care / Hosting hangout
- 🔵 **Blue**: Receiving care / Attending hangout
- 🟠 **Orange**: Rescheduled block (pending responses)
- 🟣 **Purple**: Events

## What Was Preserved

### From Working Version
- ✅ `action_type` field
- ✅ `status IN ('confirmed', 'rescheduled')` filter
- ✅ is_host logic for hangouts/sleepovers
- ✅ Provider detection for open blocks (scheduled_care_children.providing_parent_id)

### From New Version
- ✅ photo_urls field
- ✅ Photo sharing logic (provider to receiver)
- ✅ Photo sharing for hangouts (host to attendees)
- ✅ group_id, related_request_id fields
- ✅ children_data JSONB

## Troubleshooting

### Blocks still not showing?
1. Check Supabase logs for function errors
2. Verify migration ran successfully
3. Check browser console for frontend errors
4. Verify blocks have `action_type = 'rescheduled'` in database

### Photos not working?
1. Check storage bucket exists
2. Verify RLS policies are in place
3. Check `photo_urls` column exists on scheduled_care

### Wrong colors?
1. Verify frontend changes were saved
2. Hard refresh browser (Ctrl+Shift+R)
3. Check action_type value in database

## Files Modified

1. ✅ `app/calendar/page.tsx` - Frontend color logic fixed
2. 📝 `migrations/fix_calendar_function_add_action_type.sql` - **NEEDS DEPLOYMENT**

## Summary

The issue was simple but critical: when we added photo support, we accidentally removed `action_type` from the calendar function. This meant the frontend never received the information needed to color rescheduled blocks orange.

The fix merges the working version (with action_type) and the new version (with photos) into one complete function.
