# Deploy Pet Care Photos Fix

## Issues Fixed

### Issue 1: Photos Not Showing
Pet care photos upload successfully but don't appear in the detail block for users. The photos are being saved to the database correctly, but the calendar function that retrieves pet care blocks doesn't include the `photo_urls` field in its return type.

### Issue 2: Multi-Day Blocks Not Displaying Properly
Pet care blocks that span multiple days (e.g., Monday-Friday) only appear on the first day (drop-off date) instead of showing across all days until the end_date.

## Root Causes
1. The `get_scheduled_pet_care_for_calendar()` function was missing `photo_urls` in its RETURNS TABLE definition
2. The function was missing `end_date` in its RETURNS TABLE definition
3. The WHERE clause only checked `care_date` instead of checking if the block's date range overlaps the requested calendar view

## Solution
Updated the `get_scheduled_pet_care_for_calendar()` function to:
1. Include `photo_urls TEXT[]` in the return type
2. Include `end_date DATE` in the return type for multi-day blocks
3. Return photo URLs for providing care blocks
4. For receiving care blocks, fetch photos from the matching providing block (so receivers can see photos uploaded by providers)
5. Fix WHERE clause to properly handle multi-day blocks:
   ```sql
   WHERE spc.care_date <= p_end_date
   AND COALESCE(spc.end_date, spc.care_date) >= p_start_date
   ```
   This ensures blocks appear on ALL days they span, not just the first day

## Deployment Steps

### Step 1: Run the Migration

1. Open Supabase Dashboard
2. Go to **SQL Editor**
3. Click **New Query**
4. Copy the contents of `migrations/fix_pet_care_calendar_photos.sql`
5. Paste into the SQL editor
6. Click **Run**

The migration will:
- Ensure the `photo_urls` column exists in `scheduled_pet_care` table
- Update the `get_scheduled_pet_care_for_calendar()` function to include photo URLs and end_date
- Fix the WHERE clause to properly handle multi-day blocks

### Step 2: Verify the Fix

1. **Test as provider (pet sitter)**:
   - Navigate to Calendar
   - Click on a pet care providing block
   - Upload a photo
   - Verify the photo appears in the detail block
   - Check that a notification was sent

2. **Test as receiver (pet owner)**:
   - Navigate to Calendar
   - Click on the matching pet care receiving block
   - Verify the photo uploaded by the provider appears in the detail block

3. **Test multi-day blocks**:
   - Create a pet care block that spans multiple days (e.g., Monday-Friday)
   - Verify the block appears on ALL days from Monday to Friday
   - Upload a photo on Wednesday
   - Verify the block still shows on all days Monday-Friday

3. **Test photo deletion**:
   - Click the X button on a photo
   - Confirm deletion
   - Verify the photo is removed

### Step 3: Regression Testing

Verify that child care photos still work correctly:
- Upload photos to child care blocks
- Verify they display properly
- Test photo deletion

## Multi-Day Pet Care Blocks

Currently, if a pet care block spans multiple days (e.g., Monday-Friday), any photos uploaded will appear on all days of that block. This is because:
- Pet care blocks spanning multiple days are stored as a single record with `care_date` and `end_date`
- Photos are stored in an array on that single record
- There's no day-specific metadata with each photo URL

### Current Behavior
- User uploads photo on Wednesday of a Mon-Fri pet care block
- Photo appears on all days (Mon-Fri) when viewing the block

### If Day-Specific Photos Are Needed

To implement "only show photos on the day they were uploaded", we would need to:

1. **Change photo storage format** from:
   ```sql
   photo_urls TEXT[]  -- ["url1", "url2"]
   ```
   to:
   ```sql
   photo_urls JSONB  -- [{"url": "url1", "date": "2025-01-15"}, ...]
   ```

2. **Update upload logic** to include the date:
   ```typescript
   const photoWithMetadata = {
     url: publicUrl,
     date: selectedDate  // The specific day being viewed
   };
   ```

3. **Update display logic** to filter photos:
   ```typescript
   const photosForDay = selectedCare.photo_urls?.filter(
     photo => photo.date === selectedDate
   );
   ```

**Decision needed**: Should multi-day pet care blocks:
- **Option A**: Show all photos on all days (current behavior after fix)
- **Option B**: Show photos only on the specific day they were uploaded (requires additional changes)

Let me know which behavior you prefer!

## Files Changed
- `migrations/fix_pet_care_calendar_photos.sql` (new)

## Rollback Plan

If issues occur, rollback with:

```sql
-- Revert to previous function version
DROP FUNCTION IF EXISTS get_scheduled_pet_care_for_calendar(UUID, DATE, DATE);

-- Run the previous version from migrations/20250123000003_add_pet_care_calendar_function.sql
-- (copy that function definition here)
```

## Technical Details

### Function Changes
- Added `photo_urls TEXT[]` to RETURNS TABLE
- Added `end_date DATE` to RETURNS TABLE for multi-day blocks
- Added logic to return photos for providing care blocks
- Added logic to fetch provider's photos for receiving care blocks (matching the pattern used in child care)
- Fixed WHERE clause to use date range overlap logic:
  ```sql
  -- Old (broken for multi-day):
  WHERE spc.care_date BETWEEN p_start_date AND p_end_date

  -- New (handles multi-day):
  WHERE spc.care_date <= p_end_date
  AND COALESCE(spc.end_date, spc.care_date) >= p_start_date
  ```
- Added `spc.end_date` and `spc.photo_urls` to the GROUP BY clause

### Photo Sharing Logic
```sql
CASE
    WHEN spc.care_type = 'needed' THEN
        -- Receiver sees provider's photos
        COALESCE(
            (SELECT provider_care.photo_urls FROM ...),
            spc.photo_urls  -- Fallback
        )
    ELSE
        -- Provider sees their own photos
        spc.photo_urls
END
```

This ensures both the provider and receiver see the same photos.
