# Photo Upload Feature - Complete Implementation ✅

## Feature Overview

Parents can now upload and share photos during care blocks and events:
- **Care Providers** can upload photos during providing care
- **Receiving Parents** can view those photos (read-only)
- **Hangout/Sleepover Hosts** can upload photos during events
- **Attendees** can view host's photos (read-only)

## How It Works

### 1. Photo Upload (Providers/Hosts Only)

**UI Elements:**
- Camera icon button next to "Photos" label
- Click to open file picker
- Mobile: Browser shows "Camera" or "Photo Library" options
- Desktop: Opens file picker
- Upload progress indicator
- Error messages if upload fails

**Features:**
- Automatic image compression (max 1920px, 80% quality)
- Max file size: 10MB before compression
- Result: ~200-500KB per photo
- Multiple photos per block supported

### 2. Photo Display

**For Providers/Hosts:**
- Grid of uploaded photos (2 columns mobile, 3 desktop)
- Hover to see delete button
- Click photo to view full size in new tab
- Can delete own photos

**For Receivers/Attendees:**
- Same grid layout (read-only)
- Label: "Photos from Care Provider" or "Photos from Host"
- Click to view full size
- Cannot delete photos

### 3. Photo Sharing Logic

Photos are automatically shared between matched blocks:

#### Providing/Receiving Care:
```
Provider uploads → Stored in "provided" block
                        ↓
Receiver views → Function finds matching "provided" block
                        ↓ (via related_request_id)
                   Returns provider's photos
                        ↓
                   Receiver sees photos!
```

#### Hangout/Sleepover:
```
Host uploads → Stored in host's block (is_host = TRUE)
                    ↓
Attendee views → Function finds host's block
                    ↓ (via related_request_id + requester_id)
                Returns host's photos
                    ↓
                Attendee sees photos!
```

## Database Schema

### Table: scheduled_care
```sql
ALTER TABLE scheduled_care
ADD COLUMN photo_urls text[];
```

### Storage Bucket: care-photos
```
care-photos/
  {user_id}/           -- Provider/Host ID
    {care_block_id}/   -- Scheduled care ID
      {timestamp}_{filename}
```

### RLS Policies

1. **Upload**: Users can only upload to their own folders
2. **View**: Users can view if:
   - They uploaded the photo, OR
   - They're the parent_id of the care block, OR
   - Their child is in scheduled_care_children for that block
3. **Delete**: Users can only delete their own uploads

## Functions Updated

### get_scheduled_care_for_calendar
**Returns:** All scheduled care with photo URLs

**Photo Sharing Logic:**
```sql
CASE
  WHEN care_type = 'needed' THEN
    -- Get photos from matching 'provided' block
    (SELECT provider_care.photo_urls WHERE ...)
  WHEN care_type IN ('hangout', 'sleepover') THEN
    -- Get photos from host's block
    (SELECT host_care.photo_urls WHERE parent_id = requester_id)
  ELSE
    -- Return own photos (provider/host/event)
    sc.photo_urls
END
```

### get_scheduled_pet_care_for_calendar
Same logic for pet care (no hangouts for pets)

## Files Modified

### Database Migrations
1. `migrations/add_care_photos_support.sql`
   - Adds photo_urls column
   - Creates storage bucket
   - Creates RLS policies

2. `migrations/add_photo_urls_to_calendar_function.sql`
   - Updates calendar functions to return photo_urls
   - Adds photo sharing logic for matched blocks

### Frontend
1. `app/calendar/page.tsx`
   - Photo upload UI for providers/hosts
   - Photo display for receivers/attendees
   - Compression function
   - Upload/delete handlers
   - Updated type interface

## Deployment Steps

### 1. Run Database Migrations
```bash
# In Supabase Dashboard → SQL Editor
# Run migrations in order:
1. add_care_photos_support.sql
2. add_photo_urls_to_calendar_function.sql
```

### 2. Verify Deployment
- [ ] Storage bucket "care-photos" exists
- [ ] scheduled_care.photo_urls column exists
- [ ] RLS policies created on storage.objects
- [ ] Calendar functions return photo_urls

### 3. Deploy Frontend
- Code already updated in repository
- Deploy to Vercel/production

## Testing Checklist

### As Provider:
- [ ] Create providing care block
- [ ] Click camera button
- [ ] Upload photo from mobile (camera or gallery)
- [ ] Photo appears in grid
- [ ] Refresh page - photo persists
- [ ] Upload multiple photos
- [ ] Delete a photo
- [ ] Photo is removed

### As Receiver:
- [ ] View receiving care block
- [ ] See "Photos from Care Provider" section
- [ ] See all photos from provider
- [ ] Click photo - opens full size
- [ ] No delete button visible
- [ ] Refresh - photos still there

### As Host:
- [ ] Create hangout/sleepover
- [ ] Upload photos
- [ ] See photos in grid
- [ ] Can delete photos

### As Attendee:
- [ ] View hangout/sleepover block (not host)
- [ ] See "Photos from Host" section
- [ ] See all host's photos
- [ ] Read-only (no delete)

## Storage Estimates

### Free Tier (1 GB):
- Compressed photos: ~200-500 KB each
- Capacity: ~2,000-5,000 photos
- Typical usage: 2 photos per block = ~1,000 blocks

### Pro Tier (100 GB):
- Capacity: ~200,000-500,000 photos
- Typical usage: Supports thousands of users

## Benefits

✅ **Single source of truth**: Photos stored once, shared to all participants
✅ **No duplication**: Saves storage space
✅ **Automatic sharing**: Receivers/attendees automatically see provider/host photos
✅ **Secure**: RLS policies ensure only authorized users can view
✅ **Efficient**: Automatic compression reduces storage needs
✅ **Simple UX**: One button, browser handles camera vs gallery
✅ **Reliable**: Works on all browsers and devices
✅ **Scalable**: Ready for production with storage limits

## Future Enhancements

Potential improvements for later:

1. **Direct camera capture**: Revisit `capture` attribute when browser support improves
2. **Photo captions**: Add text descriptions to photos
3. **Photo reactions**: Allow parents to react/comment on photos
4. **Multiple uploads**: Drag-and-drop multiple photos at once
5. **Photo albums**: Organize photos by event/date
6. **Download all**: Bulk download all photos from a care block
7. **Photo notifications**: Notify receivers when new photos are uploaded

## Support

For issues or questions:
- See `CAMERA_TROUBLESHOOTING.md` for camera-related issues
- See `PHOTO_UPLOAD_FIX.md` for troubleshooting photo visibility
- See `HANGOUT_PHOTO_SUPPORT.md` for hangout/sleepover specifics
