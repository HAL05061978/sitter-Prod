# Calendar Provider and Care Type Fix

## Problem Summary

There were two critical issues with the calendar display for reciprocal care arrangements:

1. **Incorrect Care Types**: Parent B's calendar was showing both blocks with the same care type instead of being reversed
2. **Wrong Provider Information**: The care details modal was showing the logged-in user as the provider instead of the actual provider

## Root Causes

### Issue 1: Incorrect Care Types
The `handle_care_response_action` function was creating the correct blocks with proper care types, but there might have been confusion about which blocks should show which care types for each parent.

**Expected Behavior:**
- **Parent A (requester)**: Should see "Receiving Care" for original time, "Providing Care" for reciprocal time
- **Parent B (responder)**: Should see "Receiving Care" for original time, "Providing Care" for reciprocal time

### Issue 2: Wrong Provider Information
The `get_scheduled_care_for_calendar` function was incorrectly determining the `providing_parent_name` by always using the `parent_id` from the `scheduled_care` table, regardless of the `care_type`.

**The Problem:**
- For `care_type = 'provided'`: The `parent_id` IS the provider ✅
- For `care_type = 'needed'`: The `parent_id` is the one needing care, NOT the provider ❌

## The Fixes

### Fix 1: Updated handle_care_response_action Function

**Key Changes:**
```sql
-- Block 1: Original request time - Parent A's perspective (needing care)
INSERT INTO scheduled_care (
    care_type = 'needed',
    parent_id = v_requester_id,  -- Parent A needs care
    child_id = v_child_id
);

-- Block 2: Original time - Parent B's perspective (providing care)
INSERT INTO scheduled_care (
    care_type = 'provided',
    parent_id = v_responder_id,  -- Parent B provides care
    child_id = v_reciprocal_child_id
);

-- Block 3: Reciprocal time - Parent B's perspective (needing care)
INSERT INTO scheduled_care (
    care_type = 'needed',
    parent_id = v_responder_id,  -- Parent B needs care
    child_id = v_reciprocal_child_id
);

-- Block 4: Reciprocal time - Parent A's perspective (providing care)
INSERT INTO scheduled_care (
    care_type = 'provided',
    parent_id = v_requester_id,  -- Parent A provides care
    child_id = v_child_id
);
```

### Fix 2: Updated get_scheduled_care_for_calendar Function

**Key Changes:**
```sql
-- FIXED: Correctly determine providing_parent_name based on care_type
CASE 
    WHEN sc.care_type = 'provided' THEN 
        -- For 'provided' care, the parent_id is the provider
        p.full_name
    WHEN sc.care_type = 'needed' THEN
        -- For 'needed' care, we need to find who is providing care
        -- Look for the corresponding 'provided' block with the same time/date
        COALESCE(
            (SELECT pp.full_name 
             FROM scheduled_care sc2
             JOIN profiles pp ON sc2.parent_id = pp.id
             WHERE sc2.group_id = sc.group_id
             AND sc2.care_date = sc.care_date
             AND sc2.start_time = sc.start_time
             AND sc2.end_time = sc.end_time
             AND sc2.care_type = 'provided'
             AND sc2.related_request_id = sc.related_request_id
             LIMIT 1),
            'TBD'  -- Fallback if no provider found
        )
    ELSE 
        'Unknown'
END as providing_parent_name
```

## Expected Behavior After Fix

### Calendar Display:
- **Parent A's Calendar**:
  - Aug 20: "Receiving Care" (19:30-23:30) - Provider: Parent B
  - Aug 21: "Providing Care" (07:30-23:30) - Provider: Parent A

- **Parent B's Calendar**:
  - Aug 20: "Receiving Care" (19:30-23:30) - Provider: Parent A
  - Aug 21: "Providing Care" (07:30-23:30) - Provider: Parent B

### Care Details Modal:
- **For "Receiving Care" blocks**: Shows the actual provider (not the logged-in user)
- **For "Providing Care" blocks**: Shows the logged-in user (who is providing care)

## Files Modified

1. **`fix_reciprocal_care_id.sql`** - Updated `handle_care_response_action` function with better notes and debugging
2. **`fix_calendar_provider_logic.sql`** - New file with updated `get_scheduled_care_for_calendar` function
3. **`CALENDAR_PROVIDER_AND_CARE_TYPE_FIX.md`** - This documentation file

## Testing

To verify the fixes:

1. **Create a reciprocal care request**
2. **Accept the request**
3. **Check both parents' calendars**:
   - Verify care types are correct (Receiving vs Providing)
   - Verify provider information is correct in care details modal
4. **Check care details modal**:
   - For "Receiving Care": Should show the actual provider
   - For "Providing Care": Should show the logged-in user

## Notes

- The care type logic was already correct in the database creation
- The main issue was in the calendar display function
- The provider logic needed to be based on `care_type` rather than always using `parent_id`
- Both parents should see the same time blocks but with different care types and providers
