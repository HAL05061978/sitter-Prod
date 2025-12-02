# Photo Upload Feature - Troubleshooting & Fix

## Issues Found

### 1. Photos Not Displaying
**Problem**: Uploaded photos not showing for either provider or receiver
**Root Cause**:
1. Calendar functions were not returning the `photo_urls` field
2. Photos stored only on "provided" blocks weren't visible to "needed" (receiving) blocks

**Fix**:
1. Updated both functions to include `photo_urls` in the return table
2. Added logic to pull photos from the matching "provided" block when displaying "needed" blocks
3. Photos are now shared between matched provider/receiver blocks via `related_request_id`

### 2. Camera Not Working (Black Screen)
**Problem**: Camera capture showing black screen
**Root Cause**: Using `capture="user"` or `capture="environment"` can cause issues on some browsers

**Fix**: Changed to just `capture` (boolean attribute) which lets the browser decide the best camera to use

## Deployment Steps

### Step 1: Run Database Migration for Photo Storage
```sql
-- File: migrations/add_care_photos_support.sql
-- This creates:
-- 1. photo_urls column in scheduled_care table
-- 2. care-photos storage bucket
-- 3. RLS policies for secure photo access
```

### Step 2: Update Calendar Functions
```sql
-- File: migrations/add_photo_urls_to_calendar_function.sql
-- This updates:
-- 1. get_scheduled_care_for_calendar - adds photo_urls to return type
-- 2. get_scheduled_pet_care_for_calendar - adds photo_urls to return type
```

### Step 3: Deploy Frontend Changes
The frontend changes are already in `app/calendar/page.tsx`:
- Single camera button with menu
- Photo upload with compression
- Photo display for both provider (`care_type='provided'`) and receiver (`care_type='needed'`)
- Scrollable modal for long content
- Fixed: Changed receiver check from `'received'` to `'needed'` to match database values

## How to Deploy

### Option 1: Using the Deployment Script
```bash
deploy-photo-support.bat
```
Follow the on-screen instructions

### Option 2: Manual Deployment
1. Go to Supabase Dashboard → SQL Editor
2. Run `migrations/add_care_photos_support.sql`
3. Run `migrations/add_photo_urls_to_calendar_function.sql`
4. Verify in Supabase:
   - Storage bucket "care-photos" exists
   - scheduled_care table has photo_urls column
   - Both calendar functions include photo_urls in their return type

## Testing Checklist

After deployment:

- [ ] Create a providing care block
- [ ] Click camera button in the modal
- [ ] Select "Take Photo" - camera should open
- [ ] Take a photo and verify upload
- [ ] Photo should appear in the modal immediately
- [ ] Refresh page - photo should still be visible
- [ ] Log in as receiving parent
- [ ] View the same care block
- [ ] Photo should be visible (read-only)
- [ ] Click photo to open in new tab
- [ ] Test "Choose from Gallery" option
- [ ] Test deleting photos (hover over photo, click X)

## Technical Details

### How Photo Sharing Works

When a providing parent uploads photos:
1. Photos are stored in the "provided" care block's `photo_urls` field
2. When the receiving parent views their "needed" care block, the calendar function:
   - Detects it's a "needed" type block
   - Finds the matching "provided" block using `related_request_id`
   - Returns the photos from the "provided" block
3. Both parents see the same photos, even though they're stored only once

This ensures:
- No duplicate photo storage
- Single source of truth (provider's block)
- Receiving parents always see latest photos
- Provider controls photo uploads/deletions

### Photo Storage Path Structure
```
care-photos/
  {user_id}/
    {scheduled_care_id}/
      {timestamp}_{filename}
```

### RLS Policies
1. **Upload**: Users can only upload to their own folders
2. **View**: Users can view photos if they're the uploader OR involved in the care block
3. **Delete**: Users can only delete their own uploaded photos

### Image Compression
- Max upload size: 10MB (before compression)
- Max dimensions: 1920x1920px
- Quality: 80% JPEG
- Result: ~200-500KB per photo

## Troubleshooting

### Photos still not showing?
1. **For provider**: Photos should show immediately after upload
2. **For receiver**:
   - Make sure you ran the `add_photo_urls_to_calendar_function.sql` migration
   - Refresh the page after provider uploads photos
   - Check that the care_type is `'needed'` (not `'received'`)
3. Check browser console for errors
4. Verify migrations ran successfully
5. Check Supabase Storage to see if files are being uploaded
6. Verify RLS policies are created

### Camera still not working?
1. Check browser permissions for camera access
2. Try "Choose from Gallery" instead
3. On desktop, camera may not work - use gallery
4. On mobile, both should work

### Upload failing?
1. Check file size (must be < 10MB)
2. Check file type (must be image/*)
3. Check browser console for detailed error
4. Verify storage bucket "care-photos" exists
