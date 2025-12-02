# Pet Care Photo Upload Fix - Deployment Guide

## Issue
Pet care block photos were not being saved because the `scheduled_pet_care` table was missing the `photo_urls` column, and the photo upload logic was only updating the `scheduled_care` table.

## Solution
1. Added `photo_urls` column to `scheduled_pet_care` table
2. Updated photo upload/delete logic to detect pet care blocks and use the correct table

## Files Changed
- `migrations/add_photo_urls_to_pet_care.sql` (new)
- `app/calendar/page.tsx` (updated)

## Deployment Steps

### Step 1: Run Database Migration

1. Go to Supabase Dashboard → SQL Editor
2. Open a new query
3. Copy and paste the contents of `migrations/add_photo_urls_to_pet_care.sql`
4. Click "Run"

The migration will add:
- `photo_urls TEXT[]` column to `scheduled_pet_care` table

### Step 2: Deploy Frontend Code

The updated `app/calendar/page.tsx` file has been modified to:
- Detect whether a care block is child care or pet care using the `care_category` property
- Update the appropriate table (`scheduled_care` for child care, `scheduled_pet_care` for pet care)
- Handle photo deletions for both types of care blocks

**Changes made:**
- Line 489: Added logic to determine table name based on `care_category`
- Line 559: Added same logic for photo deletion

### Step 3: Test the Fix

1. **Create a pet care providing block**:
   - Go to Calendar
   - Create a new pet care providing block

2. **Upload a photo**:
   - Click on the pet care block
   - Click "Upload Photo" button
   - Select a photo from camera or gallery
   - Verify the photo uploads successfully

3. **Verify photo visibility**:
   - As the provider: You should see the uploaded photo
   - As the receiver (pet owner): You should also see the uploaded photo
   - Both parents should receive a notification about the photo upload

4. **Test photo deletion**:
   - Click the X button on an uploaded photo
   - Confirm deletion
   - Verify the photo is removed for both parents

## Verification

After deployment, verify:
- [ ] Pet care block photos upload successfully
- [ ] Photos appear for both provider and receiver
- [ ] Photo upload notifications are sent
- [ ] Photos can be deleted
- [ ] Child care block photos still work correctly (regression test)

## Rollback Plan

If issues occur:

1. **Remove the column** (SQL Editor):
   ```sql
   ALTER TABLE scheduled_pet_care DROP COLUMN IF EXISTS photo_urls;
   ```

2. **Revert calendar page changes** using git:
   ```bash
   git checkout HEAD -- app/calendar/page.tsx
   ```

## Technical Details

### Migration SQL
```sql
ALTER TABLE scheduled_pet_care
ADD COLUMN IF NOT EXISTS photo_urls TEXT[];

COMMENT ON COLUMN scheduled_pet_care.photo_urls IS 'Array of URLs to photos uploaded during pet care';
```

### Code Changes
The photo upload and delete functions now determine the correct table dynamically:

```typescript
// Determine which table to update based on care category
const tableName = selectedCare.care_category === 'pet' ? 'scheduled_pet_care' : 'scheduled_care';

const { error: updateError } = await supabase
  .from(tableName)
  .update({ photo_urls: updatedPhotos })
  .eq('id', selectedCare.id);
```

This ensures:
- Child care blocks → update `scheduled_care` table
- Pet care blocks → update `scheduled_pet_care` table

## Notes

- The `care-photos` storage bucket is used for both child and pet care photos
- Photo URLs are stored as a TEXT[] array in both tables
- The RLS policies for the `care-photos` bucket apply to both types of photos
- The `notify_photo_upload` RPC function may need to be updated if it only handles child care (check implementation)
